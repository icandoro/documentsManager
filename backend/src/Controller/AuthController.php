<?php

namespace App\Controller;

use App\Entity\Profile;
use App\Entity\User;
use App\Service\ClientCodeGenerator;
use App\Service\InstitutionSlugGenerator;
use App\Service\PublicCompanyLookupService;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\PasswordHasherFactoryInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;

final class AuthController
{
    #[Route('/api/auth/register', name: 'api_auth_register', methods: ['OPTIONS'])]
    #[Route('/api/auth/institutions', name: 'api_auth_institutions_options', methods: ['OPTIONS'])]
    public function registerOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/auth/login', name: 'api_auth_login_options', methods: ['OPTIONS'])]
    public function loginOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/auth/two-factor/verify', name: 'api_auth_two_factor_verify_options', methods: ['OPTIONS'])]
    public function twoFactorVerifyOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/auth/login', name: 'api_auth_login_submit', methods: ['POST'])]
    public function login(
        Request $request,
        EntityManagerInterface $entityManager,
        PasswordHasherFactoryInterface $passwordHasherFactory,
        ClientCodeGenerator $clientCodeGenerator,
    ): JsonResponse {
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return $this->cors(new JsonResponse(['message' => 'Datele trimise nu sunt valide.'], 400));
        }

        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $password = (string) ($payload['password'] ?? '');

        $user = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user instanceof User) {
            return $this->cors(new JsonResponse(['message' => 'Email sau parola incorecte.'], 401));
        }

        $passwordHasher = $passwordHasherFactory->getPasswordHasher($user);

        if (!$passwordHasher->verify($user->getPassword(), $password)) {
            return $this->cors(new JsonResponse(['message' => 'Email sau parola incorecte.'], 401));
        }

        if ($user->isTwoFactorEnabled()) {
            return $this->cors(new JsonResponse([
                'message' => 'Introdu codul din aplicatia de autentificare pentru a finaliza login-ul.',
                'requiresTwoFactor' => true,
                'challengeToken' => $this->createTwoFactorChallenge($user),
                'maskedEmail' => $this->maskEmail($user->getEmail()),
            ], 202));
        }

        return $this->cors(new JsonResponse([
            'message' => 'Autentificare reusita.',
            'token' => $this->createToken($user),
            'user' => $this->serializeUser($user, $clientCodeGenerator),
        ]));
    }

    #[Route('/api/auth/two-factor/verify', name: 'api_auth_two_factor_verify_submit', methods: ['POST'])]
    public function verifyTwoFactor(
        Request $request,
        EntityManagerInterface $entityManager,
        ClientCodeGenerator $clientCodeGenerator,
    ): JsonResponse {
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return $this->cors(new JsonResponse(['message' => 'Datele trimise nu sunt valide.'], 400));
        }

        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $code = preg_replace('/\D+/', '', (string) ($payload['code'] ?? '')) ?? '';
        $challengeToken = (string) ($payload['challengeToken'] ?? '');

        $user = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user instanceof User || !$user->isTwoFactorEnabled()) {
            return $this->cors(new JsonResponse(['message' => 'Cererea 2FA nu este valida.'], 401));
        }

        if (!$this->isValidTwoFactorChallenge($challengeToken, $user)) {
            return $this->cors(new JsonResponse(['message' => 'Sesiunea de verificare a expirat. Reia autentificarea.'], 401));
        }

        $secret = $user->getTotpSecret();

        if (!$secret || !$this->verifyTotp($secret, $code)) {
            return $this->cors(new JsonResponse(['message' => 'Codul 2FA nu este valid.'], 401));
        }

        return $this->cors(new JsonResponse([
            'message' => 'Verificare 2FA reusita.',
            'token' => $this->createToken($user),
            'user' => $this->serializeUser($user, $clientCodeGenerator),
        ]));
    }

    #[Route('/api/auth/register', name: 'api_auth_register_submit', methods: ['POST'])]
    public function register(
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher,
        PublicCompanyLookupService $companyLookup,
        InstitutionSlugGenerator $slugGenerator,
        ClientCodeGenerator $clientCodeGenerator,
    ): JsonResponse {
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return $this->cors(new JsonResponse(['message' => 'Datele trimise nu sunt valide.'], 400));
        }

        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $password = (string) ($payload['password'] ?? '');
        $firstName = (string) ($payload['firstName'] ?? '');
        $lastName = (string) ($payload['lastName'] ?? '');
        $accountType = (string) ($payload['accountType'] ?? 'individual');
        $company = is_array($payload['company'] ?? null) ? $payload['company'] : [];
        $personalData = is_array($payload['personalData'] ?? null) ? $payload['personalData'] : [];
        $selectedInstitutionIds = $this->normalizeInstitutionIds($payload['selectedInstitutionIds'] ?? []);

        if (!in_array($accountType, ['individual', 'company', 'institution'], true)) {
            return $this->cors(new JsonResponse(['message' => 'Tipul de cont nu este valid.'], 422));
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->cors(new JsonResponse(['message' => 'Adresa de email nu este valida.'], 422));
        }

        if (strlen($password) < 8) {
            return $this->cors(new JsonResponse(['message' => 'Parola trebuie sa aiba cel putin 8 caractere.'], 422));
        }

        $companyLookupResult = null;

        if (in_array($accountType, ['company', 'institution'], true)) {
            $normalizedCif = $companyLookup->normalizeCif((string) ($company['cif'] ?? ''));

            if (!preg_match('/^\d{2,10}$/', $normalizedCif)) {
                return $this->cors(new JsonResponse(['message' => 'Introdu un CIF valid pentru persoana juridica sau institutie.'], 422));
            }

            $companyLookupResult = $companyLookup->lookup($normalizedCif);

            if (($companyLookupResult['lookupStatus'] ?? null) === 'invalid') {
                return $this->cors(new JsonResponse(['message' => 'Introdu un CIF valid pentru persoana juridica sau institutie.'], 422));
            }

            $company = $this->mergeCompanyData($company, $companyLookupResult, $normalizedCif);

            if (trim((string) ($company['name'] ?? '')) === '') {
                return $this->cors(new JsonResponse([
                    'message' => 'Nu am putut prelua denumirea din ANAF pentru acest CIF. Completeaza manual denumirea si incearca din nou.',
                    'companyLookup' => $companyLookupResult,
                ], 422));
            }
        }

        $user = (new User())
            ->setEmail($email)
            ->setRoles(['ROLE_USER']);
        $user->setPassword($passwordHasher->hashPassword($user, $password));

        $identifier = $accountType === 'company'
            ? $this->normalizeIdentifier((string) ($company['cif'] ?? ''))
            : $this->normalizeIdentifier((string) ($personalData['cnp'] ?? ''));
        $profileAddress = $this->profileAddress($accountType, $personalData, $company);
        $institutionId = $accountType === 'institution'
            ? $slugGenerator->fromNameAndCif((string) ($company['name'] ?? ''), (string) ($company['cif'] ?? ''))
            : null;
        $initialLinkedInstitutionIds = $institutionId !== null ? [$institutionId] : [];

        $profile = (new Profile())
            ->setUser($user)
            ->setFirstName($firstName)
            ->setLastName($lastName)
            ->setPersonType($accountType)
            ->setCompanyName((string) ($company['name'] ?? ''))
            ->setTaxIdentifier((string) ($company['cif'] ?? ''))
            ->setOptionalFields([
                'company' => $company,
                'companyLookup' => $companyLookupResult,
                'identityDocument' => $accountType === 'individual' ? [
                    'series' => (string) ($personalData['series'] ?? ''),
                    'number' => (string) ($personalData['number'] ?? ''),
                    'issuedBy' => (string) ($personalData['issuedBy'] ?? ''),
                    'validUntil' => (string) ($personalData['validUntil'] ?? ''),
                ] : null,
                'cnp' => $accountType === 'individual' ? $identifier : null,
                'phone' => (string) ($payload['phone'] ?? $company['phone'] ?? ''),
                'address' => $profileAddress,
                'selectedInstitutionIds' => $selectedInstitutionIds,
                'linkedInstitutionIds' => $initialLinkedInstitutionIds,
                'emailConfirmationStatus' => 'pending',
                'onboardingDocuments' => [],
                'onboardingStatus' => $accountType === 'institution' ? 'awaiting_email_confirmation' : 'email_pending',
            ]);
        $user->setProfile($profile);

        try {
            $entityManager->persist($user);
            $entityManager->persist($profile);
            $entityManager->flush();

            if (in_array($accountType, ['individual', 'company'], true) && $identifier !== '') {
                $linkResult = $this->linkAccountToInstitutionTaxpayers($entityManager, $user, $accountType, $identifier, $selectedInstitutionIds);
                $optionalFields = $profile->getOptionalFields();
                $optionalFields['linkedInstitutionIds'] = $linkResult['linkedInstitutionIds'];
                $optionalFields['requestedInstitutionIds'] = $linkResult['requestedInstitutionIds'];
                $profile->setOptionalFields($optionalFields);
                $entityManager->flush();
            }
        } catch (UniqueConstraintViolationException) {
            return $this->cors(new JsonResponse(['message' => 'Exista deja un cont cu acest email.'], 409));
        }

        return $this->cors(new JsonResponse([
            'message' => 'Contul a fost creat. Confirma adresa de email pentru pasul urmator.',
            'requiresEmailConfirmation' => true,
            'nextStep' => $accountType === 'institution' ? 'email_confirmation_then_institution_onboarding' : 'email_confirmation',
            'company' => in_array($accountType, ['company', 'institution'], true) ? $company : null,
            'companyLookup' => $companyLookupResult,
            'user' => $this->serializeUser($user, $clientCodeGenerator),
        ], 201));
    }

    #[Route('/api/auth/institutions', name: 'api_auth_institutions_list', methods: ['GET'])]
    public function institutions(EntityManagerInterface $entityManager, InstitutionSlugGenerator $slugGenerator): JsonResponse
    {
        $rows = $entityManager->getConnection()->fetchAllAssociative(
            "SELECT u.id AS user_id, u.email, p.company_name, p.tax_identifier, p.optional_fields
             FROM profiles p
             INNER JOIN users u ON u.id = p.user_id
             WHERE p.person_type = 'institution'
             ORDER BY p.company_name ASC, u.email ASC"
        );

        $items = array_map(function (array $row) use ($slugGenerator): array {
            $optionalFields = json_decode((string) ($row['optional_fields'] ?? '{}'), true);
            $optionalFields = is_array($optionalFields) ? $optionalFields : [];
            $company = is_array($optionalFields['company'] ?? null) ? $optionalFields['company'] : [];
            $name = trim((string) ($row['company_name'] ?? $company['name'] ?? ''));
            $locality = $this->extractInstitutionLocality($name, $optionalFields);
            $county = $this->extractInstitutionCounty($optionalFields);
            $id = $slugGenerator->fromNameAndCif($name !== '' ? $name : (string) ($row['email'] ?? ''), (string) ($row['tax_identifier'] ?? ''));
            $userId = (int) ($row['user_id'] ?? 0);

            return [
                'id' => $id,
                'optionKey' => sprintf('institution-%d-%s', $userId, $id),
                'databaseId' => $userId,
                'name' => $name !== '' ? $name : (string) ($row['email'] ?? ''),
                'locality' => $locality,
                'county' => $county,
                'cif' => (string) ($row['tax_identifier'] ?? $company['cif'] ?? ''),
                'email' => (string) ($row['email'] ?? ''),
                'status' => (string) ($optionalFields['status'] ?? 'activ'),
            ];
        }, $rows);

        return $this->cors(new JsonResponse(['items' => $items]));
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(User $user, ClientCodeGenerator $clientCodeGenerator): array
    {
        $profile = $user->getProfile();
        $optionalFields = $profile?->getOptionalFields() ?? [];
        $personType = $profile?->getPersonType() ?? 'individual';
        $roles = $user->getRoles();
        $role = in_array('ROLE_SUPER_ADMIN', $roles, true) ? 'superadmin' : (in_array('ROLE_ADMIN', $roles, true) ? 'admin' : 'user');
        $firstName = $profile?->getFirstName() ?? '';
        $lastName = $profile?->getLastName() ?? '';
        $companyName = $profile?->getCompanyName();
        $name = trim(sprintf('%s %s', $lastName, $firstName));

        if ($name === '') {
            $name = $companyName ?: $user->getEmail();
        }

        return [
            'id' => $user->getId() !== null ? 'user-'.$user->getId() : $user->getAccountCode(),
            'databaseId' => $user->getId(),
            'name' => $name,
            'email' => $user->getEmail(),
            'accountCode' => $user->getAccountCode(),
            'clientCode' => $clientCodeGenerator->fromAccountCode($user->getAccountCode()),
            'role' => $role,
            'accountType' => match ($personType) {
                'institution' => 'institution',
                'company' => 'company',
                default => 'individual',
            },
            'firstName' => $firstName,
            'lastName' => $lastName,
            'companyName' => $companyName,
            'cnp' => $optionalFields['cnp'] ?? null,
            'cif' => $profile?->getTaxIdentifier(),
            'phone' => $optionalFields['phone'] ?? $profile?->getPhone(),
            'address' => $optionalFields['address'] ?? null,
            'status' => $optionalFields['status'] ?? 'activ',
            'linkedInstitutionIds' => $optionalFields['linkedInstitutionIds'] ?? [],
            'onboardingStatus' => $optionalFields['onboardingStatus'] ?? null,
            'sentCount' => 0,
            'receivedCount' => 0,
        ];
    }

    /**
     * @param array<string, mixed> $submitted
     * @param array<string, mixed> $lookup
     *
     * @return array<string, mixed>
     */
    private function mergeCompanyData(array $submitted, array $lookup, string $normalizedCif): array
    {
        return [
            ...$submitted,
            'cif' => $normalizedCif,
            'name' => trim((string) ($lookup['name'] ?? '')) !== '' ? $lookup['name'] : ($submitted['name'] ?? ''),
            'registrationNumber' => trim((string) ($lookup['registrationNumber'] ?? '')) !== '' ? $lookup['registrationNumber'] : ($submitted['registrationNumber'] ?? ''),
            'address' => trim((string) ($lookup['address'] ?? '')) !== '' ? $lookup['address'] : ($submitted['address'] ?? ''),
            'postalCode' => trim((string) ($lookup['postalCode'] ?? '')) !== '' ? $lookup['postalCode'] : ($submitted['postalCode'] ?? ''),
            'phone' => trim((string) ($lookup['phone'] ?? '')) !== '' ? $lookup['phone'] : ($submitted['phone'] ?? ''),
            'status' => trim((string) ($lookup['status'] ?? '')) !== '' ? $lookup['status'] : ($submitted['status'] ?? ''),
            'publicDataSource' => $lookup['source'] ?? 'manual',
            'publicDataLookupStatus' => $lookup['lookupStatus'] ?? 'manual',
        ];
    }

    /**
     * @param mixed $value
     *
     * @return list<string>
     */
    private function normalizeInstitutionIds(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            fn (mixed $item): string => trim((string) $item),
            $value
        ))));
    }

    private function normalizeIdentifier(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }

    /**
     * @param array<string, mixed> $personalData
     * @param array<string, mixed> $company
     *
     * @return array<string, string>
     */
    private function profileAddress(string $accountType, array $personalData, array $company): array
    {
        if ($accountType === 'individual') {
            return [
                'street' => trim((string) ($personalData['address'] ?? '')),
                'city' => trim((string) ($personalData['city'] ?? '')),
                'county' => trim((string) ($personalData['county'] ?? '')),
                'postalCode' => trim((string) ($personalData['postalCode'] ?? '')),
            ];
        }

        return [
            'street' => trim((string) ($company['address'] ?? '')),
            'city' => trim((string) ($company['locality'] ?? '')),
            'county' => trim((string) ($company['county'] ?? '')),
            'postalCode' => trim((string) ($company['postalCode'] ?? '')),
        ];
    }

    /**
     * @param list<string> $selectedInstitutionIds
     *
     * @return array{linkedInstitutionIds: list<string>, requestedInstitutionIds: list<string>}
     */
    private function linkAccountToInstitutionTaxpayers(
        EntityManagerInterface $entityManager,
        User $user,
        string $accountType,
        string $identifier,
        array $selectedInstitutionIds,
    ): array {
        $taxpayerType = $accountType === 'company' ? 'company' : 'person';
        $rows = $entityManager->getConnection()->fetchAllAssociative(
            'SELECT id, institution_id FROM institution_taxpayers WHERE type = :type AND identifier = :identifier',
            ['type' => $taxpayerType, 'identifier' => $identifier],
        );

        $linkedInstitutionIds = [];

        foreach ($rows as $row) {
            $institutionId = (string) ($row['institution_id'] ?? '');

            if ($institutionId === '') {
                continue;
            }

            $entityManager->getConnection()->executeStatement(
                'UPDATE institution_taxpayers SET linked_user_id = :userId, status = :status WHERE id = :id',
                ['userId' => $user->getId(), 'status' => 'legat', 'id' => (int) $row['id']],
            );
            $linkedInstitutionIds[] = $institutionId;
        }

        $linkedInstitutionIds = array_values(array_unique($linkedInstitutionIds));
        $requestedInstitutionIds = array_values(array_diff($selectedInstitutionIds, $linkedInstitutionIds));

        return [
            'linkedInstitutionIds' => $linkedInstitutionIds,
            'requestedInstitutionIds' => $requestedInstitutionIds,
        ];
    }

    /**
     * @param array<string, mixed> $optionalFields
     */
    private function extractInstitutionLocality(string $name, array $optionalFields): string
    {
        $address = is_array($optionalFields['address'] ?? null) ? $optionalFields['address'] : [];
        $company = is_array($optionalFields['company'] ?? null) ? $optionalFields['company'] : [];
        $locality = trim((string) ($address['city'] ?? $company['locality'] ?? ''));

        if ($locality !== '') {
            return $locality;
        }

        if (preg_match('/primaria\s+(.+)/i', $name, $matches)) {
            return trim($matches[1]);
        }

        return '';
    }

    /**
     * @param array<string, mixed> $optionalFields
     */
    private function extractInstitutionCounty(array $optionalFields): string
    {
        $address = is_array($optionalFields['address'] ?? null) ? $optionalFields['address'] : [];
        $company = is_array($optionalFields['company'] ?? null) ? $optionalFields['company'] : [];

        return trim((string) ($address['county'] ?? $company['county'] ?? ''));
    }

    private function cors(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Access-Control-Allow-Origin', 'http://localhost:13000');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        return $response;
    }

    private function createToken(User $user): string
    {
        $payload = [
            'email' => $user->getEmail(),
            'accountCode' => $user->getAccountCode(),
            'expiresAt' => time() + 3600,
        ];
        $encodedPayload = rtrim(strtr(base64_encode(json_encode($payload, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
        $signature = hash_hmac('sha256', $encodedPayload, $_ENV['APP_SECRET'] ?? 'dev-secret');

        return $encodedPayload.'.'.$signature;
    }

    private function createTwoFactorChallenge(User $user): string
    {
        $payload = [
            'email' => $user->getEmail(),
            'expiresAt' => time() + 300,
            'purpose' => 'two-factor-login',
        ];
        $encodedPayload = rtrim(strtr(base64_encode(json_encode($payload, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
        $signature = hash_hmac('sha256', $encodedPayload, $_ENV['APP_SECRET'] ?? 'dev-secret');

        return $encodedPayload.'.'.$signature;
    }

    private function isValidTwoFactorChallenge(string $challengeToken, User $user): bool
    {
        [$encodedPayload, $signature] = array_pad(explode('.', $challengeToken, 2), 2, '');

        if ($encodedPayload === '' || $signature === '') {
            return false;
        }

        $expectedSignature = hash_hmac('sha256', $encodedPayload, $_ENV['APP_SECRET'] ?? 'dev-secret');

        if (!hash_equals($expectedSignature, $signature)) {
            return false;
        }

        $paddedPayload = str_pad(strtr($encodedPayload, '-_', '+/'), (int) ceil(strlen($encodedPayload) / 4) * 4, '=', STR_PAD_RIGHT);
        $decoded = json_decode(base64_decode($paddedPayload) ?: '', true);

        return is_array($decoded)
            && ($decoded['purpose'] ?? null) === 'two-factor-login'
            && ($decoded['email'] ?? null) === $user->getEmail()
            && (int) ($decoded['expiresAt'] ?? 0) >= time();
    }

    private function verifyTotp(string $secret, string $code): bool
    {
        if (!preg_match('/^\d{6}$/', $code)) {
            return false;
        }

        $timeStep = (int) floor(time() / 30);

        for ($offset = -1; $offset <= 1; $offset++) {
            if (hash_equals($this->totpCode($secret, $timeStep + $offset), $code)) {
                return true;
            }
        }

        return false;
    }

    private function totpCode(string $secret, int $timeStep): string
    {
        $key = $this->base32Decode($secret);
        $counter = pack('N*', 0, $timeStep);
        $hash = hash_hmac('sha1', $counter, $key, true);
        $offset = ord($hash[19]) & 0xf;
        $binary = ((ord($hash[$offset]) & 0x7f) << 24)
            | ((ord($hash[$offset + 1]) & 0xff) << 16)
            | ((ord($hash[$offset + 2]) & 0xff) << 8)
            | (ord($hash[$offset + 3]) & 0xff);

        return str_pad((string) ($binary % 1000000), 6, '0', STR_PAD_LEFT);
    }

    private function base32Decode(string $secret): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $cleanSecret = strtoupper(preg_replace('/[^A-Z2-7]/i', '', $secret) ?? '');
        $bits = '';

        foreach (str_split($cleanSecret) as $char) {
            $value = strpos($alphabet, $char);
            if ($value === false) {
                continue;
            }
            $bits .= str_pad(decbin($value), 5, '0', STR_PAD_LEFT);
        }

        $output = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $output .= chr(bindec($byte));
            }
        }

        return $output;
    }

    private function maskEmail(string $email): string
    {
        [$name, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return substr($name, 0, 2).'***@'.$domain;
    }
}
