<?php

namespace App\Controller;

use App\Entity\Institution;
use App\Entity\Profile;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\KernelInterface;
use Symfony\Component\Routing\Attribute\Route;

final class DocumentController
{
    private const ONBOARDING_DOCUMENT_LABELS = [
        'signedRequest' => 'Cerere semnata institutie',
        'proofDocuments' => 'Documente doveditoare',
        'delegateDocument' => 'Document persoana delegata',
    ];

    #[Route('/api/documents/upload', name: 'api_documents_upload_options', methods: ['OPTIONS'])]
    public function uploadOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/documents/upload', name: 'api_documents_upload', methods: ['POST'])]
    public function upload(
        Request $request,
        EntityManagerInterface $entityManager,
        KernelInterface $kernel,
    ): JsonResponse {
        $ownerId = (int) $request->request->get('ownerId', 0);
        $category = trim((string) $request->request->get('category', 'other'));
        $file = $request->files->get('file');

        if (!$file instanceof UploadedFile) {
            return $this->cors(new JsonResponse(['message' => 'Fisierul lipseste din cerere.'], 400));
        }

        $owner = $entityManager->getRepository(User::class)->find($ownerId);

        if (!$owner instanceof User) {
            return $this->cors(new JsonResponse(['message' => 'Utilizatorul documentului nu a fost gasit.'], 404));
        }

        $originalName = $file->getClientOriginalName();
        $title = $this->documentTitle($originalName);
        $extension = strtolower($file->guessExtension() ?: pathinfo($originalName, PATHINFO_EXTENSION) ?: 'bin');
        $storageName = $this->storageName($title, $extension);
        $relativePath = sprintf('documents/%d/%s', $ownerId, $storageName);
        $targetDirectory = sprintf('%s/var/uploads/documents/%d', $kernel->getProjectDir(), $ownerId);

        if (!is_dir($targetDirectory) && !mkdir($targetDirectory, 0775, true) && !is_dir($targetDirectory)) {
            return $this->cors(new JsonResponse(['message' => 'Directorul pentru fisiere nu poate fi creat.'], 500));
        }

        $file->move($targetDirectory, $storageName);

        $uploadedAt = new \DateTimeImmutable();
        $connection = $entityManager->getConnection();
        $connection->insert('documents', [
            'owner_id' => $ownerId,
            'title' => mb_substr($title, 0, 120),
            'type' => mb_substr($category !== '' ? $category : 'other', 0, 40),
            'storage_path' => $relativePath,
            'mime_type' => mb_substr($file->getClientMimeType() ?: 'application/octet-stream', 0, 80),
            'size_bytes' => max(0, (int) $file->getSize()),
            'signature_status' => 'unsigned',
            'created_at' => $uploadedAt->format('Y-m-d H:i:s'),
        ]);

        return $this->cors(new JsonResponse([
            'id' => (int) $connection->lastInsertId(),
            'title' => $title,
            'type' => $category !== '' ? $category : 'other',
            'category' => $category !== '' ? $category : 'other',
            'sizeBytes' => max(0, (int) $file->getSize()),
            'storageName' => $storageName,
            'storagePath' => $relativePath,
            'uploadedAt' => $uploadedAt->format(\DateTimeInterface::ATOM),
        ], 201));
    }

    #[Route('/api/institutions/onboarding/documents', name: 'api_institutions_onboarding_documents_options', methods: ['OPTIONS'])]
    public function onboardingDocumentsOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/institutions/onboarding/documents', name: 'api_institutions_onboarding_documents', methods: ['POST'])]
    public function uploadOnboardingDocuments(
        Request $request,
        EntityManagerInterface $entityManager,
        KernelInterface $kernel,
        Security $security,
    ): JsonResponse {
        $user = $security->getUser();

        if (!$user instanceof User) {
            return $this->cors(new JsonResponse(['message' => 'Autentificare necesara.'], 401));
        }

        $profile = $user->getProfile();
        $institution = $profile?->getInstitutionId() !== null
            ? $entityManager->getRepository(Institution::class)->find($profile->getInstitutionId())
            : null;

        if (!$profile instanceof Profile || !$institution instanceof Institution) {
            return $this->cors(new JsonResponse(['message' => 'Doar conturile de institutie pot incarca documente de inrolare.'], 403));
        }

        $files = [];

        foreach (array_keys(self::ONBOARDING_DOCUMENT_LABELS) as $key) {
            $file = $request->files->get($key);

            if (!$file instanceof UploadedFile) {
                return $this->cors(new JsonResponse(['message' => sprintf('Documentul "%s" lipseste din cerere.', self::ONBOARDING_DOCUMENT_LABELS[$key])], 400));
            }

            $files[$key] = $file;
        }

        $userId = $user->getId();
        $targetDirectory = sprintf('%s/var/uploads/institutions/%d', $kernel->getProjectDir(), $userId);

        if (!is_dir($targetDirectory) && !mkdir($targetDirectory, 0775, true) && !is_dir($targetDirectory)) {
            return $this->cors(new JsonResponse(['message' => 'Directorul pentru fisiere nu poate fi creat.'], 500));
        }

        $connection = $entityManager->getConnection();
        $uploadedAt = new \DateTimeImmutable();
        $onboardingDocuments = [];

        foreach ($files as $key => $file) {
            $label = self::ONBOARDING_DOCUMENT_LABELS[$key];
            $originalName = $file->getClientOriginalName();
            $extension = strtolower($file->guessExtension() ?: pathinfo($originalName, PATHINFO_EXTENSION) ?: 'bin');
            $storageName = $this->storageName($label, $extension);
            $relativePath = sprintf('institutions/%d/%s', $userId, $storageName);

            $file->move($targetDirectory, $storageName);

            $connection->insert('documents', [
                'owner_id' => $userId,
                'title' => mb_substr($label, 0, 120),
                'type' => 'institution_onboarding',
                'storage_path' => $relativePath,
                'mime_type' => mb_substr($file->getClientMimeType() ?: 'application/octet-stream', 0, 80),
                'size_bytes' => max(0, (int) $file->getSize()),
                'signature_status' => 'unsigned',
                'created_at' => $uploadedAt->format('Y-m-d H:i:s'),
            ]);

            $onboardingDocuments[$key] = [
                'documentId' => (int) $connection->lastInsertId(),
                'label' => $label,
                'originalName' => $originalName,
                'storagePath' => $relativePath,
                'uploadedAt' => $uploadedAt->format(\DateTimeInterface::ATOM),
            ];
        }

        $institution->setOnboardingDocuments($onboardingDocuments);
        $institution->setOnboardingStatus('pending_admin_review');
        $entityManager->flush();

        return $this->cors(new JsonResponse([
            'message' => 'Documentele au fost trimise pentru verificare.',
            'documents' => $onboardingDocuments,
            'onboardingStatus' => 'pending_admin_review',
        ]));
    }

    private function documentTitle(string $fileName): string
    {
        $title = trim(pathinfo($fileName, PATHINFO_FILENAME));

        return $title !== '' ? $title : 'document';
    }

    private function storageName(string $title, string $extension): string
    {
        $safeTitle = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $title);
        $safeTitle = is_string($safeTitle) ? $safeTitle : $title;
        $safeTitle = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $safeTitle) ?? 'document';
        $safeTitle = trim($safeTitle, '-_.') ?: 'document';
        $timestamp = (new \DateTimeImmutable())->format('YmdHisv');
        $random = bin2hex(random_bytes(4));

        return sprintf('%s-%s-%s.%s', $timestamp, $random, strtolower($safeTitle), $extension);
    }

    private function cors(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Access-Control-Allow-Origin', 'http://localhost:13000');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        return $response;
    }
}
