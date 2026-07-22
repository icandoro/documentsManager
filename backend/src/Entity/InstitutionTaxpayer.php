<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'institution_taxpayers')]
#[ORM\UniqueConstraint(name: 'uniq_institution_taxpayer_identifier', fields: ['institutionId', 'type', 'identifier'])]
class InstitutionTaxpayer
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer', options: ['unsigned' => true])]
    private ?int $id = null;

    #[ORM\Column(name: 'institution_id', type: 'integer', options: ['unsigned' => true])]
    private int $institutionId = 0;

    #[ORM\Column(name: 'correspondence_id', length: 64, nullable: true)]
    private ?string $correspondenceId = null;

    #[ORM\Column(length: 16)]
    private string $type = 'person';

    #[ORM\Column(length: 180)]
    private string $name = '';

    #[ORM\Column(length: 32)]
    private string $identifier = '';

    #[ORM\Column(length: 120)]
    private string $locality = '';

    #[ORM\Column(length: 16)]
    private string $status = 'nelegat';

    #[ORM\Column(name: 'linked_user_id', type: 'integer', nullable: true, options: ['unsigned' => true])]
    private ?int $linkedUserId = null;

    #[ORM\Column(length: 180, nullable: true)]
    private ?string $email = null;

    #[ORM\Column(length: 32, nullable: true)]
    private ?string $phone = null;

    #[ORM\Column(length: 48, nullable: true)]
    private ?string $accountKind = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $address = null;

    #[ORM\Column(type: 'json')]
    private array $details = [];

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

    public function getInstitutionId(): int
    {
        return $this->institutionId;
    }

    public function setInstitutionId(int $institutionId): self
    {
        $this->institutionId = $institutionId;

        return $this;
    }

    public function getCorrespondenceId(): ?string
    {
        return $this->correspondenceId;
    }

    public function setCorrespondenceId(?string $correspondenceId): self
    {
        $correspondenceId = trim((string) $correspondenceId);
        $this->correspondenceId = $correspondenceId !== '' ? $correspondenceId : null;

        return $this;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): self
    {
        $this->type = $type === 'company' ? 'company' : 'person';

        return $this;
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

    public function getIdentifier(): string
    {
        return $this->identifier;
    }

    public function setIdentifier(string $identifier): self
    {
        $this->identifier = preg_replace('/\D+/', '', $identifier) ?? '';

        return $this;
    }

    public function getLocality(): string
    {
        return $this->locality;
    }

    public function setLocality(string $locality): self
    {
        $this->locality = trim($locality);

        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): self
    {
        $this->status = $status === 'legat' ? 'legat' : 'nelegat';

        return $this;
    }

    public function getLinkedUserId(): ?int
    {
        return $this->linkedUserId;
    }

    public function setLinkedUserId(?int $linkedUserId): self
    {
        $this->linkedUserId = $linkedUserId;

        return $this;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(?string $email): self
    {
        $email = trim((string) $email);
        $this->email = $email !== '' ? strtolower($email) : null;

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

    public function getAccountKind(): ?string
    {
        return $this->accountKind;
    }

    public function setAccountKind(?string $accountKind): self
    {
        $accountKind = trim((string) $accountKind);
        $this->accountKind = $accountKind !== '' ? $accountKind : null;

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

    /**
     * @return array<string, mixed>
     */
    public function getDetails(): array
    {
        return $this->details;
    }

    public function setDetails(array $details): self
    {
        $this->details = $details;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
