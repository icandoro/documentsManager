<?php

namespace App\Controller;

use App\Entity\Institution;
use App\Entity\Profile;
use App\Entity\User;
use App\Service\AppMailer;
use App\Service\ClientCodeGenerator;
use App\Service\PublicCompanyLookupService;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Cache\CacheItemPoolInterface;
use Symfony\Bundle\SecurityBundle\Security;
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
    #[Route('/api/auth/two-factor/setup', name: 'api_auth_two_factor_setup_options', methods: ['OPTIONS'])]
    #[Route('/api/auth/two-factor/enable', name: 'api_auth_two_factor_enable_options', methods: ['OPTIONS'])]
    #[Route('/api/auth/two-factor/disable', name: 'api_auth_two_factor_disable_options', methods: ['OPTIONS'])]
    public function twoFactorVerifyOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/institutions/link', name: 'api_institutions_link_options', methods: ['OPTIONS'])]
    public function linkInstitutionOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/auth/email/confirm', name: 'api_auth_email_confirm_options', methods: ['OPTIONS'])]
    #[Route('/api/auth/email/resend', name: 'api_auth_email_resend_options', methods: ['OPTIONS'])]
    #[Route('/api/auth/forgot-password', name: 'api_auth_forgot_password_options', methods: ['OPTIONS'])]
    #[Route('/api/auth/reset-password', name: 'api_auth_reset_password_options', methods: ['OPTIONS'])]
    public function accountRecoveryOptions(): JsonResponse
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

        $optionalFields = $user->getProfile()?->getOptionalFields() ?? [];
        $emailConfirmationStatus = $optionalFields['emailConfirmationStatus'] ?? 'confirmed';

        if ($emailConfirmationStatus !== 'confirmed') {
            return $this->cors(new JsonResponse([
                'message' => 'Confirma adresa de email inainte de a te autentifica. Verifica-ti inbox-ul.',
                'requiresEmailConfirmation' => true,
            ], 403));
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
        ClientCodeGenerator $clientCodeGenerator,
        AppMailer $appMailer,
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
                'linkedInstitutionIds' => [],
                'emailConfirmationStatus' => 'pending',
                'onboardingStatus' => $accountType === 'institution' ? 'awaiting_email_confirmation' : 'email_pending',
            ]);
        $user->setProfile($profile);

        try {
            $entityManager->persist($user);
            $entityManager->persist($profile);
            $entityManager->flush();

            if ($accountType === 'institution') {
                $institution = (new Institution())
                    ->setName((string) ($company['name'] ?? ''))
                    ->setCif((string) ($company['cif'] ?? ''))
                    ->setLocality((string) ($profileAddress['city'] ?? ''))
                    ->setCounty((string) ($profileAddress['county'] ?? ''))
                    ->setAddress((string) ($company['address'] ?? ''))
                    ->setPhone((string) ($payload['phone'] ?? $company['phone'] ?? ''))
                    ->setContactEmail($email)
                    ->setStatus('in_verificare')
                    ->setOnboardingStatus('awaiting_email_confirmation');
                $entityManager->persist($institution);
                $entityManager->flush();

                $profile->setInstitutionId($institution->getId());
                $entityManager->flush();
            }

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

        $name = trim(sprintf('%s %s', $firstName, $lastName)) ?: (string) ($company['name'] ?? $email);
        $confirmUrl = rtrim($_ENV['FRONTEND_URL'] ?? 'http://localhost:3000', '/').'/auth/confirm-email?token='.urlencode($this->createEmailConfirmationToken($user));
        $appMailer->sendEmailConfirmation($email, $name, $confirmUrl);

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
    public function institutions(EntityManagerInterface $entityManager): JsonResponse
    {
        $rows = $entityManager->getConnection()->fetchAllAssociative(
            'SELECT id, name, cif, locality, county, contact_email, status
             FROM institutions
             ORDER BY name ASC'
        );

        $items = array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'locality' => (string) ($row['locality'] ?? ''),
            'county' => (string) ($row['county'] ?? ''),
            'cif' => (string) $row['cif'],
            'email' => (string) ($row['contact_email'] ?? ''),
            'status' => (string) $row['status'],
        ], $rows);

        return $this->cors(new JsonResponse(['items' => $items]));
    }

    #[Route('/api/institutions/link', name: 'api_institutions_link', methods: ['POST'])]
    public function linkInstitution(
        Request $request,
        EntityManagerInterface $entityManager,
        Security $security,
        ClientCodeGenerator $clientCodeGenerator,
    ): JsonResponse {
        $user = $security->getUser();

        if (!$user instanceof User) {
            return $this->cors(new JsonResponse(['message' => 'Autentificare necesara.'], 401));
        }

        $profile = $user->getProfile();
        $personType = $profile?->getPersonType();

        if (!$profile instanceof Profile || !in_array($personType, ['individual', 'company'], true)) {
            return $this->cors(new JsonResponse(['message' => 'Doar conturile de persoana fizica sau juridica se pot inrola la o institutie.'], 403));
        }

        $payload = json_decode($request->getContent(), true);
        $institutionId = (int) (is_array($payload) ? ($payload['institutionId'] ?? 0) : 0);

        if ($institutionId <= 0) {
            return $this->cors(new JsonResponse(['message' => 'Institutia este obligatorie.'], 422));
        }

        $identifier = $personType === 'company'
            ? $this->normalizeIdentifier((string) $profile->getTaxIdentifier())
            : $this->normalizeIdentifier((string) ($profile->getOptionalFields()['cnp'] ?? ''));

        if ($identifier === '') {
            return $this->cors(new JsonResponse(['message' => 'Completeaza mai intai CNP-ul sau CIF-ul in profil, apoi incearca din nou.'], 422));
        }

        $linkResult = $this->linkAccountToInstitutionTaxpayers($entityManager, $user, $personType, $identifier, [(string) $institutionId]);

        $optionalFields = $profile->getOptionalFields();
        $existingLinked = array_values(array_filter(
            is_array($optionalFields['linkedInstitutionIds'] ?? null) ? $optionalFields['linkedInstitutionIds'] : []
        ));
        $existingRequested = array_values(array_filter(
            is_array($optionalFields['requestedInstitutionIds'] ?? null) ? $optionalFields['requestedInstitutionIds'] : []
        ));

        $linkedInstitutionIds = array_values(array_unique([...$existingLinked, ...$linkResult['linkedInstitutionIds']]));
        $requestedInstitutionIds = array_values(array_diff(
            array_unique([...$existingRequested, ...$linkResult['requestedInstitutionIds']]),
            $linkedInstitutionIds
        ));

        $optionalFields['linkedInstitutionIds'] = $linkedInstitutionIds;
        $optionalFields['requestedInstitutionIds'] = $requestedInstitutionIds;
        $profile->setOptionalFields($optionalFields);
        $entityManager->flush();

        $isLinked = in_array((string) $institutionId, $linkedInstitutionIds, true);

        return $this->cors(new JsonResponse([
            'message' => $isLinked
                ? 'Ai fost gasit in evidenta institutiei. Contul a fost legat automat.'
                : 'Cererea a fost inregistrata. Institutia trebuie sa te adauge in evidenta ei pentru activare.',
            'status' => $isLinked ? 'linked' : 'requested',
            'user' => $this->serializeUser($user, $clientCodeGenerator),
        ]));
    }

    #[Route('/api/auth/email/confirm', name: 'api_auth_email_confirm', methods: ['POST'])]
    public function confirmEmail(Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        $token = (string) (is_array($payload) ? ($payload['token'] ?? '') : '');
        $decoded = $this->decodeSignedToken($token);

        if (!is_array($decoded) || ($decoded['purpose'] ?? null) !== 'email-confirm' || (int) ($decoded['expiresAt'] ?? 0) < time()) {
            return $this->cors(new JsonResponse(['message' => 'Linkul de confirmare este invalid sau a expirat.'], 410));
        }

        $email = strtolower(trim((string) ($decoded['email'] ?? '')));
        $user = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user instanceof User) {
            return $this->cors(new JsonResponse(['message' => 'Contul nu a fost gasit.'], 404));
        }

        $profile = $user->getProfile();

        if ($profile instanceof Profile) {
            $optionalFields = $profile->getOptionalFields();
            $optionalFields['emailConfirmationStatus'] = 'confirmed';
            $profile->setOptionalFields($optionalFields);
            $entityManager->flush();
        }

        return $this->cors(new JsonResponse([
            'message' => 'Adresa de email a fost confirmata. Te poti autentifica acum.',
            'accountType' => $profile?->getPersonType() ?? 'individual',
        ]));
    }

    #[Route('/api/auth/email/resend', name: 'api_auth_email_resend', methods: ['POST'])]
    public function resendEmailConfirmation(Request $request, EntityManagerInterface $entityManager, AppMailer $appMailer): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        $email = strtolower(trim((string) (is_array($payload) ? ($payload['email'] ?? '') : '')));
        $generic = new JsonResponse(['message' => 'Daca adresa de email exista si nu este inca confirmata, am retrimis linkul de confirmare.']);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->cors($generic);
        }

        $user = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user instanceof User) {
            return $this->cors($generic);
        }

        $profile = $user->getProfile();
        $optionalFields = $profile?->getOptionalFields() ?? [];

        if (($optionalFields['emailConfirmationStatus'] ?? 'confirmed') === 'confirmed') {
            return $this->cors($generic);
        }

        $name = trim(sprintf('%s %s', $profile?->getLastName() ?? '', $profile?->getFirstName() ?? '')) ?: $email;
        $confirmUrl = rtrim($_ENV['FRONTEND_URL'] ?? 'http://localhost:3000', '/').'/auth/confirm-email?token='.urlencode($this->createEmailConfirmationToken($user));
        $appMailer->sendEmailConfirmation($email, $name, $confirmUrl);

        return $this->cors($generic);
    }

    #[Route('/api/auth/forgot-password', name: 'api_auth_forgot_password', methods: ['POST'])]
    public function forgotPassword(Request $request, EntityManagerInterface $entityManager, AppMailer $appMailer, CacheItemPoolInterface $cache): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        $email = strtolower(trim((string) (is_array($payload) ? ($payload['email'] ?? '') : '')));
        $generic = new JsonResponse(['message' => 'Daca adresa de email exista in platforma, am trimis instructiuni de resetare a parolei.']);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->cors($generic);
        }

        $rateLimitItem = $cache->getItem('password_reset_throttle_'.hash('sha256', $email));

        if ($rateLimitItem->isHit()) {
            return $this->cors($generic);
        }

        $rateLimitItem->set(true)->expiresAfter(60);
        $cache->save($rateLimitItem);

        $user = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user instanceof User) {
            return $this->cors($generic);
        }

        $profile = $user->getProfile();
        $name = trim(sprintf('%s %s', $profile?->getLastName() ?? '', $profile?->getFirstName() ?? '')) ?: $email;
        $resetUrl = rtrim($_ENV['FRONTEND_URL'] ?? 'http://localhost:3000', '/').'/auth/reset-password?token='.urlencode($this->createPasswordResetToken($user));
        $appMailer->sendPasswordReset($email, $name, $resetUrl);

        return $this->cors($generic);
    }

    #[Route('/api/auth/reset-password', name: 'api_auth_reset_password', methods: ['POST'])]
    public function resetPassword(Request $request, EntityManagerInterface $entityManager, UserPasswordHasherInterface $passwordHasher, AppMailer $appMailer): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        $token = (string) (is_array($payload) ? ($payload['token'] ?? '') : '');
        $password = (string) (is_array($payload) ? ($payload['password'] ?? '') : '');
        $decoded = $this->decodeSignedToken($token);

        if (!is_array($decoded) || ($decoded['purpose'] ?? null) !== 'password-reset' || (int) ($decoded['expiresAt'] ?? 0) < time()) {
            return $this->cors(new JsonResponse(['message' => 'Linkul de resetare este invalid sau a expirat.'], 410));
        }

        if (strlen($password) < 8) {
            return $this->cors(new JsonResponse(['message' => 'Parola trebuie sa aiba cel putin 8 caractere.'], 422));
        }

        $email = strtolower(trim((string) ($decoded['email'] ?? '')));
        $user = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user instanceof User) {
            return $this->cors(new JsonResponse(['message' => 'Contul nu a fost gasit.'], 404));
        }

        if (!hash_equals($this->passwordFingerprint($user), (string) ($decoded['pwFingerprint'] ?? ''))) {
            return $this->cors(new JsonResponse(['message' => 'Linkul de resetare este invalid sau a expirat.'], 410));
        }

        $user->setPassword($passwordHasher->hashPassword($user, $password));
        $entityManager->flush();

        $profile = $user->getProfile();
        $name = trim(sprintf('%s %s', $profile?->getLastName() ?? '', $profile?->getFirstName() ?? '')) ?: $email;
        $appMailer->sendPasswordChanged($email, $name);

        return $this->cors(new JsonResponse(['message' => 'Parola a fost schimbata. Te poti autentifica cu noua parola.']));
    }

    #[Route('/api/auth/two-factor/setup', name: 'api_auth_two_factor_setup', methods: ['POST'])]
    public function setupTwoFactor(Security $security, EntityManagerInterface $entityManager): JsonResponse
    {
        $user = $security->getUser();

        if (!$user instanceof User) {
            return $this->cors(new JsonResponse(['message' => 'Autentificare necesara.'], 401));
        }

        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';

        for ($i = 0; $i < 32; $i++) {
            $secret .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        $user->setTotpSecret($secret);
        $entityManager->flush();

        $issuer = 'GhiseulCetateanului';
        $otpauthUrl = sprintf(
            'otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30',
            rawurlencode($issuer),
            rawurlencode($user->getEmail()),
            $secret,
            rawurlencode($issuer),
        );

        return $this->cors(new JsonResponse([
            'secret' => $secret,
            'otpauthUrl' => $otpauthUrl,
        ]));
    }

    #[Route('/api/auth/two-factor/enable', name: 'api_auth_two_factor_enable', methods: ['POST'])]
    public function enableTwoFactor(Request $request, Security $security, EntityManagerInterface $entityManager): JsonResponse
    {
        $user = $security->getUser();

        if (!$user instanceof User) {
            return $this->cors(new JsonResponse(['message' => 'Autentificare necesara.'], 401));
        }

        $payload = json_decode($request->getContent(), true);
        $code = preg_replace('/\D+/', '', (string) (is_array($payload) ? ($payload['code'] ?? '') : '')) ?? '';
        $secret = $user->getTotpSecret();

        if (!$secret) {
            return $this->cors(new JsonResponse(['message' => 'Genereaza mai intai un secret 2FA.'], 422));
        }

        if (!$this->verifyTotp($secret, $code)) {
            return $this->cors(new JsonResponse(['message' => 'Codul introdus nu este valid.'], 422));
        }

        $user->setTwoFactorEnabled(true);
        $entityManager->flush();

        return $this->cors(new JsonResponse(['message' => 'Autentificarea in doi pasi a fost activata.']));
    }

    #[Route('/api/auth/two-factor/disable', name: 'api_auth_two_factor_disable', methods: ['POST'])]
    public function disableTwoFactor(
        Request $request,
        Security $security,
        EntityManagerInterface $entityManager,
        PasswordHasherFactoryInterface $passwordHasherFactory,
    ): JsonResponse {
        $user = $security->getUser();

        if (!$user instanceof User) {
            return $this->cors(new JsonResponse(['message' => 'Autentificare necesara.'], 401));
        }

        $payload = json_decode($request->getContent(), true);
        $password = (string) (is_array($payload) ? ($payload['password'] ?? '') : '');
        $passwordHasher = $passwordHasherFactory->getPasswordHasher($user);

        if (!$passwordHasher->verify($user->getPassword(), $password)) {
            return $this->cors(new JsonResponse(['message' => 'Parola introdusa este incorecta.'], 401));
        }

        $user->setTwoFactorEnabled(false);
        $user->setTotpSecret(null);
        $entityManager->flush();

        return $this->cors(new JsonResponse(['message' => 'Autentificarea in doi pasi a fost dezactivata.']));
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
            'institutionId' => $profile?->getInstitutionId(),
            'twoFactorEnabled' => $user->isTwoFactorEnabled(),
            'linkedInstitutionIds' => $optionalFields['linkedInstitutionIds'] ?? [],
            'requestedInstitutionIds' => $optionalFields['requestedInstitutionIds'] ?? [],
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
        if ($selectedInstitutionIds === []) {
            return ['linkedInstitutionIds' => [], 'requestedInstitutionIds' => []];
        }

        $taxpayerType = $accountType === 'company' ? 'company' : 'person';
        $institutionIds = array_values(array_unique(array_map('intval', $selectedInstitutionIds)));
        $connection = $entityManager->getConnection();
        $rows = $connection->fetchAllAssociative(
            'SELECT id, institution_id FROM institution_taxpayers
             WHERE type = :type AND identifier = :identifier AND institution_id IN (:institutionIds)',
            ['type' => $taxpayerType, 'identifier' => $identifier, 'institutionIds' => $institutionIds],
            ['institutionIds' => ArrayParameterType::INTEGER],
        );

        $linkedInstitutionIds = [];

        foreach ($rows as $row) {
            $institutionId = (string) ($row['institution_id'] ?? '');

            if ($institutionId === '') {
                continue;
            }

            $connection->executeStatement(
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

    private function cors(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Access-Control-Allow-Origin', 'http://localhost:13000');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        return $response;
    }

    /**
     * @param array<string, mixed> $claims
     */
    private function createSignedToken(array $claims): string
    {
        $encodedPayload = rtrim(strtr(base64_encode(json_encode($claims, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
        $signature = hash_hmac('sha256', $encodedPayload, $_ENV['APP_SECRET'] ?? 'dev-secret');

        return $encodedPayload.'.'.$signature;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeSignedToken(string $token): ?array
    {
        [$encodedPayload, $signature] = array_pad(explode('.', $token, 2), 2, '');

        if ($encodedPayload === '' || $signature === '') {
            return null;
        }

        $expectedSignature = hash_hmac('sha256', $encodedPayload, $_ENV['APP_SECRET'] ?? 'dev-secret');

        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $paddedPayload = str_pad(strtr($encodedPayload, '-_', '+/'), (int) ceil(strlen($encodedPayload) / 4) * 4, '=', STR_PAD_RIGHT);
        $decoded = json_decode(base64_decode($paddedPayload) ?: '', true);

        return is_array($decoded) ? $decoded : null;
    }

    private function createToken(User $user): string
    {
        return $this->createSignedToken([
            'email' => $user->getEmail(),
            'accountCode' => $user->getAccountCode(),
            'expiresAt' => time() + 3600,
        ]);
    }

    private function createTwoFactorChallenge(User $user): string
    {
        return $this->createSignedToken([
            'email' => $user->getEmail(),
            'expiresAt' => time() + 300,
            'purpose' => 'two-factor-login',
        ]);
    }

    private function isValidTwoFactorChallenge(string $challengeToken, User $user): bool
    {
        $decoded = $this->decodeSignedToken($challengeToken);

        return is_array($decoded)
            && ($decoded['purpose'] ?? null) === 'two-factor-login'
            && ($decoded['email'] ?? null) === $user->getEmail()
            && (int) ($decoded['expiresAt'] ?? 0) >= time();
    }

    private function createEmailConfirmationToken(User $user): string
    {
        return $this->createSignedToken([
            'email' => $user->getEmail(),
            'purpose' => 'email-confirm',
            'expiresAt' => time() + 86400,
        ]);
    }

    private function createPasswordResetToken(User $user): string
    {
        return $this->createSignedToken([
            'email' => $user->getEmail(),
            'purpose' => 'password-reset',
            'expiresAt' => time() + 1800,
            'pwFingerprint' => $this->passwordFingerprint($user),
        ]);
    }

    private function passwordFingerprint(User $user): string
    {
        return hash_hmac('sha256', $user->getPassword(), $_ENV['APP_SECRET'] ?? 'dev-secret');
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
