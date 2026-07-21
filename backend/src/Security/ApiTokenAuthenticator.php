<?php

namespace App\Security;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;

final class ApiTokenAuthenticator extends AbstractAuthenticator
{
    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
    }

    public function supports(Request $request): ?bool
    {
        return str_starts_with((string) $request->headers->get('Authorization'), 'Bearer ');
    }

    public function authenticate(Request $request): Passport
    {
        $token = trim(substr((string) $request->headers->get('Authorization'), 7));
        $payload = $this->decodeToken($token);
        $email = strtolower(trim((string) ($payload['email'] ?? '')));

        if ($email === '' || (int) ($payload['expiresAt'] ?? 0) < time()) {
            throw new BadCredentialsException('Token expirat sau invalid.');
        }

        return new SelfValidatingPassport(new UserBadge($email, function (string $userIdentifier): User {
            $user = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $userIdentifier]);

            if (!$user instanceof User) {
                throw new BadCredentialsException('Utilizatorul nu exista.');
            }

            return $user;
        }));
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        return null;
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        return new JsonResponse(['message' => 'Sesiunea a expirat. Autentifica-te din nou.'], Response::HTTP_UNAUTHORIZED);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeToken(string $token): array
    {
        [$encodedPayload, $signature] = array_pad(explode('.', $token, 2), 2, '');

        if ($encodedPayload === '' || $signature === '') {
            throw new BadCredentialsException('Token invalid.');
        }

        $expectedSignature = hash_hmac('sha256', $encodedPayload, $_ENV['APP_SECRET'] ?? 'dev-secret');

        if (!hash_equals($expectedSignature, $signature)) {
            throw new BadCredentialsException('Semnatura token invalida.');
        }

        $paddedPayload = str_pad(strtr($encodedPayload, '-_', '+/'), (int) ceil(strlen($encodedPayload) / 4) * 4, '=', STR_PAD_RIGHT);
        $decoded = json_decode(base64_decode($paddedPayload) ?: '', true);

        if (!is_array($decoded)) {
            throw new BadCredentialsException('Payload token invalid.');
        }

        return $decoded;
    }
}
