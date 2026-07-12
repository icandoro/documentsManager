<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'documents')]
class Document
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer', options: ['unsigned' => true])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'documents')]
    #[ORM\JoinColumn(name: 'owner_id', nullable: false, onDelete: 'CASCADE')]
    private ?User $owner = null;

    #[ORM\Column(length: 120)]
    private string $title = '';

    #[ORM\Column(length: 40)]
    private string $type = 'other';

    #[ORM\Column(name: 'storage_path')]
    private string $storagePath = '';

    #[ORM\Column(name: 'mime_type', length: 80)]
    private string $mimeType = 'application/octet-stream';

    #[ORM\Column(name: 'size_bytes', type: 'integer', options: ['unsigned' => true])]
    private int $sizeBytes = 0;

    #[ORM\Column(name: 'signature_status', length: 24)]
    private string $signatureStatus = 'unsigned';

    #[ORM\Column(name: 'created_at')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }
}
