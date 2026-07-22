<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'profiles')]
class Profile
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer', options: ['unsigned' => true])]
    private ?int $id = null;

    #[ORM\OneToOne(inversedBy: 'profile', targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
    private ?User $user = null;

    #[ORM\Column(name: 'first_name', length: 64)]
    private string $firstName = '';

    #[ORM\Column(name: 'last_name', length: 64)]
    private string $lastName = '';

    #[ORM\Column(length: 32, nullable: true)]
    private ?string $phone = null;

    #[ORM\Column(length: 8)]
    private string $language = 'ro';

    #[ORM\Column(length: 64)]
    private string $timezone = 'Europe/Bucharest';

    #[ORM\Column(name: 'person_type', length: 24)]
    private string $personType = 'individual';

    #[ORM\Column(name: 'company_name', length: 160, nullable: true)]
    private ?string $companyName = null;

    #[ORM\Column(name: 'tax_identifier', length: 32, nullable: true)]
    private ?string $taxIdentifier = null;

    #[ORM\Column(name: 'institution_id', type: 'integer', nullable: true, options: ['unsigned' => true])]
    private ?int $institutionId = null;

    #[ORM\Column(name: 'optional_fields', type: 'json')]
    private array $optionalFields = [];

    public function setUser(User $user): self
    {
        $this->user = $user;

        return $this;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setFirstName(string $firstName): self
    {
        $this->firstName = trim($firstName);

        return $this;
    }

    public function getFirstName(): string
    {
        return $this->firstName;
    }

    public function setLastName(string $lastName): self
    {
        $this->lastName = trim($lastName);

        return $this;
    }

    public function getLastName(): string
    {
        return $this->lastName;
    }

    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function getTimezone(): string
    {
        return $this->timezone;
    }

    public function setPersonType(string $personType): self
    {
        $this->personType = $personType;

        return $this;
    }

    public function getPersonType(): string
    {
        return $this->personType;
    }

    public function setCompanyName(?string $companyName): self
    {
        $this->companyName = $companyName ? trim($companyName) : null;

        return $this;
    }

    public function getCompanyName(): ?string
    {
        return $this->companyName;
    }

    public function setTaxIdentifier(?string $taxIdentifier): self
    {
        $this->taxIdentifier = $taxIdentifier ? preg_replace('/\D+/', '', $taxIdentifier) : null;

        return $this;
    }

    public function getTaxIdentifier(): ?string
    {
        return $this->taxIdentifier;
    }

    public function getInstitutionId(): ?int
    {
        return $this->institutionId;
    }

    public function setInstitutionId(?int $institutionId): self
    {
        $this->institutionId = $institutionId;

        return $this;
    }

    public function setOptionalFields(array $optionalFields): self
    {
        $this->optionalFields = $optionalFields;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function getOptionalFields(): array
    {
        return $this->optionalFields;
    }
}
