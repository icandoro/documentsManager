<?php

namespace App\Security;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\PasswordUpgraderInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

final class DatabaseUserProvider implements UserProviderInterface, PasswordUpgraderInterface
{
    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
    }

    public function loadUserByIdentifier(string $identifier): UserInterface
    {
        $user = $this->entityManager
            ->getRepository(User::class)
            ->findOneBy(['email' => strtolower(trim($identifier))]);

        if (!$user instanceof User) {
            throw new UserNotFoundException(sprintf('User "%s" was not found.', $identifier));
        }

        return $user;
    }

    public function refreshUser(UserInterface $user): UserInterface
    {
        return $this->loadUserByIdentifier($user->getUserIdentifier());
    }

    public function supportsClass(string $class): bool
    {
        return User::class === $class || is_subclass_of($class, User::class);
    }

    public function upgradePassword(PasswordAuthenticatedUserInterface $user, string $newHashedPassword): void
    {
        if (!$user instanceof User) {
            return;
        }

        $user->setPassword($newHashedPassword);
        $this->entityManager->flush();
    }
}
