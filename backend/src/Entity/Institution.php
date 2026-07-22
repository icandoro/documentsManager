<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'institutions')]
#[ORM\UniqueConstraint(name: 'uniq_institutions_cif', fields: ['cif'])]
class Institution
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer', options: ['unsigned' => true])]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    private string $name = '';

    #[ORM\Column(length: 32)]
    private string $cif = '';

    #[ORM\Column(length: 120, nullable: true)]
    private ?string $locality = null;

    #[ORM\Column(length: 120, nullable: true)]
    private ?string $county = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $address = null;

    #[ORM\Column(length: 32, nullable: true)]
    private ?string $phone = null;

    #[ORM\Column(name: 'contact_email', length: 180, nullable: true)]
    private ?string $contactEmail = null;

    #[ORM\Column(length: 16)]
    private string $status = 'in_verificare';

    #[ORM\Column(name: 'onboarding_status', length: 48, nullable: true)]
    private ?string $onboardingStatus = null;

    #[ORM\Column(name: 'onboarding_documents', type: 'json')]
    private array $onboardingDocuments = [];

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = trim($name);

        return $this;
    }

    public function getCif(): string
    {
        return $this->cif;
    }

    public function setCif(string $cif): self
    {
        $this->cif = preg_replace('/\D+/', '', $cif) ?? '';

        return $this;
    }

    public function getLocality(): ?string
    {
        return $this->locality;
    }

    public function setLocality(?string $locality): self
    {
        $locality = trim((string) $locality);
        $this->locality = $locality !== '' ? $locality : null;

        return $this;
    }

    public function getCounty(): ?string
    {
        return $this->county;
    }

    public function setCounty(?string $county): self
    {
        $county = trim((string) $county);
        $this->county = $county !== '' ? $county : null;

        return $this;
    }

    public function getAddress(): ?string
    {
        return $this->address;
    }

    public function setAddress(?string $address): self
    {
        $address = trim((string) $address);
        $this->address = $address !== '' ? $address : null;

        return $this;
    }

    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function setPhone(?string $phone): self
    {
        $phone = trim((string) $phone);
        $this->phone = $phone !== '' ? $phone : null;

        return $this;
    }

    public function getContactEmail(): ?string
    {
        return $this->contactEmail;
    }

    public function setContactEmail(?string $contactEmail): self
    {
        $contactEmail = trim((string) $contactEmail);
        $this->contactEmail = $contactEmail !== '' ? strtolower($contactEmail) : null;

        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): self
    {
        $this->status = in_array($status, ['activ', 'in_verificare', 'suspendat'], true) ? $status : 'in_verificare';

        return $this;
    }

    public function getOnboardingStatus(): ?string
    {
        return $this->onboardingStatus;
    }

    public function setOnboardingStatus(?string $onboardingStatus): self
    {
        $this->onboardingStatus = $onboardingStatus;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function getOnboardingDocuments(): array
    {
        return $this->onboardingDocuments;
    }

    /**
     * @param array<string, mixed> $onboardingDocuments
     */
    public function setOnboardingDocuments(array $onboardingDocuments): self
    {
        $this->onboardingDocuments = $onboardingDocuments;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
