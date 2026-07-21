<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity]
#[ORM\Table(name: 'users')]
#[ORM\UniqueConstraint(name: 'uniq_users_email', fields: ['email'])]
#[ORM\UniqueConstraint(name: 'uniq_users_account_code', fields: ['accountCode'])]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer', options: ['unsigned' => true])]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    private string $email = '';

    #[ORM\Column(name: 'account_code', length: 24)]
    private string $accountCode = '';

    #[ORM\Column(type: 'json')]
    private array $roles = [];

    #[ORM\Column(name: 'password_hash')]
    private string $password = '';

    #[ORM\Column(name: 'two_factor_enabled')]
    private bool $twoFactorEnabled = false;

    #[ORM\Column(name: 'totp_secret', length: 64, nullable: true)]
    private ?string $totpSecret = null;

    #[ORM\OneToOne(mappedBy: 'user', targetEntity: Profile::class, cascade: ['persist', 'remove'])]
    private ?Profile $profile = null;

    /** @var Collection<int, Document> */
    #[ORM\OneToMany(mappedBy: 'owner', targetEntity: Document::class, cascade: ['persist', 'remove'])]
    private Collection $documents;

    public function __construct(?int $id = null, string $email = '', string $password = '', array $roles = [], ?string $accountCode = null)
    {
        $this->id = $id;
        $this->email = $email;
        $this->password = $password;
        $this->roles = $roles;
        $this->accountCode = $accountCode ?? strtoupper(bin2hex(random_bytes(4)));
        $this->documents = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): self
    {
        $this->email = strtolower(trim($email));

        return $this;
    }

    public function getUserIdentifier(): string
    {
        return $this->email;
    }

    public function getAccountCode(): string
    {
        return $this->accountCode;
    }

    public function getRoles(): array
    {
        return array_unique([...$this->roles, 'ROLE_USER']);
    }

    public function setRoles(array $roles): self
    {
        $this->roles = $roles;

        return $this;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): self
    {
        $this->password = $password;

        return $this;
    }

    public function eraseCredentials(): void
    {
    }

    public function isTwoFactorEnabled(): bool
    {
        return $this->twoFactorEnabled;
    }

    public function setTwoFactorEnabled(bool $enabled): self
    {
        $this->twoFactorEnabled = $enabled;

        return $this;
    }

    public function setTotpSecret(?string $totpSecret): self
    {
        $this->totpSecret = $totpSecret;

        return $this;
    }

    public function getTotpSecret(): ?string
    {
        return $this->totpSecret;
    }

    public function setProfile(Profile $profile): self
    {
        $this->profile = $profile;

        return $this;
    }

    public function getProfile(): ?Profile
    {
        return $this->profile;
    }
}
