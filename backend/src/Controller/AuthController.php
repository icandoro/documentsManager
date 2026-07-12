<?php

namespace App\Controller;

use App\Entity\Profile;
use App\Entity\User;
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
    public function registerOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/auth/login', name: 'api_auth_login_options', methods: ['OPTIONS'])]
    public function loginOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/auth/login', name: 'api_auth_login_submit', methods: ['POST'])]
    public function login(
        Request $request,
        EntityManagerInterface $entityManager,
        PasswordHasherFactoryInterface $passwordHasherFactory,
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
                'message' => 'Contul are 2FA activ. Verificarea codului va fi implementata in pasul urmator.',
                'requiresTwoFactor' => true,
            ], 202));
        }

        return $this->cors(new JsonResponse([
            'message' => 'Autentificare reusita.',
            'token' => $this->createToken($user),
            'user' => [
                'email' => $user->getEmail(),
                'accountCode' => $user->getAccountCode(),
            ],
        ]));
    }

    #[Route('/api/auth/register', name: 'api_auth_register_submit', methods: ['POST'])]
    public function register(
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher,
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

        if (!in_array($accountType, ['individual', 'company', 'institution'], true)) {
            return $this->cors(new JsonResponse(['message' => 'Tipul de cont nu este valid.'], 422));
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->cors(new JsonResponse(['message' => 'Adresa de email nu este valida.'], 422));
        }

        if (strlen($password) < 8) {
            return $this->cors(new JsonResponse(['message' => 'Parola trebuie sa aiba cel putin 8 caractere.'], 422));
        }

        if (in_array($accountType, ['company', 'institution'], true) && !preg_match('/^\d{2,10}$/', (string) ($company['cif'] ?? ''))) {
            return $this->cors(new JsonResponse(['message' => 'Introdu un CIF valid pentru persoana juridica sau institutie.'], 422));
        }

        $user = (new User())
            ->setEmail($email)
            ->setRoles(['ROLE_USER']);
        $user->setPassword($passwordHasher->hashPassword($user, $password));

        $profile = (new Profile())
            ->setUser($user)
            ->setFirstName($firstName)
            ->setLastName($lastName)
            ->setPersonType($accountType)
            ->setCompanyName((string) ($company['name'] ?? ''))
            ->setTaxIdentifier((string) ($company['cif'] ?? ''))
            ->setOptionalFields([
                'company' => $company,
                'emailConfirmationStatus' => 'pending',
                'onboardingDocuments' => [],
                'onboardingStatus' => $accountType === 'institution' ? 'awaiting_email_confirmation' : 'email_pending',
            ]);
        $user->setProfile($profile);

        try {
            $entityManager->persist($user);
            $entityManager->persist($profile);
            $entityManager->flush();
        } catch (UniqueConstraintViolationException) {
            return $this->cors(new JsonResponse(['message' => 'Exista deja un cont cu acest email.'], 409));
        }

        return $this->cors(new JsonResponse([
            'message' => 'Contul a fost creat. Confirma adresa de email pentru pasul urmator.',
            'requiresEmailConfirmation' => true,
            'nextStep' => $accountType === 'institution' ? 'email_confirmation_then_institution_onboarding' : 'email_confirmation',
            'user' => [
                'email' => $user->getEmail(),
                'accountCode' => $user->getAccountCode(),
                'accountType' => $accountType,
            ],
        ], 201));
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
}
