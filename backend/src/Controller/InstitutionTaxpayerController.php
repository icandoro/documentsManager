<?php

namespace App\Controller;

use App\Entity\InstitutionTaxpayer;
use App\Entity\User;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class InstitutionTaxpayerController
{
    #[Route('/api/institution-taxpayers', name: 'api_institution_taxpayers_options', methods: ['OPTIONS'])]
    #[Route('/api/institution-taxpayers/import', name: 'api_institution_taxpayers_import_options', methods: ['OPTIONS'])]
    public function options(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/institution-taxpayers', name: 'api_institution_taxpayers_list', methods: ['GET'])]
    public function list(Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $institutionId = (int) $request->query->get('institutionId', 0);

        if ($institutionId <= 0) {
            return $this->cors(new JsonResponse(['message' => 'Institutia curenta lipseste.'], 422));
        }

        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(50, max(1, (int) $request->query->get('limit', 20)));
        $type = (string) $request->query->get('type', 'all');
        $status = (string) $request->query->get('status', 'all');
        $accountKind = (string) $request->query->get('accountKind', 'all');
        $query = mb_strtolower(trim((string) $request->query->get('q', '')));
        $id = trim((string) $request->query->get('id', ''));

        $qb = $entityManager->createQueryBuilder()
            ->select('taxpayer')
            ->from(InstitutionTaxpayer::class, 'taxpayer')
            ->where('taxpayer.institutionId = :institutionId')
            ->setParameter('institutionId', $institutionId);

        if ($id !== '') {
            $qb->andWhere('taxpayer.id = :id')->setParameter('id', (int) $id);
        }

        if (in_array($type, ['person', 'company'], true)) {
            $qb->andWhere('taxpayer.type = :type')->setParameter('type', $type);
        }

        if (in_array($status, ['legat', 'nelegat'], true)) {
            $qb->andWhere('taxpayer.status = :status')->setParameter('status', $status);
        }

        if ($accountKind !== 'all' && $accountKind !== '') {
            $qb->andWhere('taxpayer.accountKind = :accountKind')->setParameter('accountKind', $accountKind);
        }

        if ($query !== '') {
            $qb->andWhere('LOWER(taxpayer.name) LIKE :query OR taxpayer.identifier LIKE :query OR (taxpayer.email IS NOT NULL AND LOWER(taxpayer.email) LIKE :query)')
                ->setParameter('query', '%'.$query.'%');
        }

        $countQb = clone $qb;
        $total = (int) $countQb
            ->select('COUNT(taxpayer.id)')
            ->setFirstResult(0)
            ->setMaxResults(null)
            ->getQuery()
            ->getSingleScalarResult();

        $items = $qb
            ->orderBy('taxpayer.createdAt', 'DESC')
            ->addOrderBy('taxpayer.id', 'DESC')
            ->setFirstResult(($page - 1) * $limit)
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();

        return $this->cors(new JsonResponse([
            'items' => array_map(fn (InstitutionTaxpayer $taxpayer) => $this->serializeTaxpayer($taxpayer), $items),
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'totalPages' => max(1, (int) ceil($total / $limit)),
            'summary' => $this->summary($entityManager, $institutionId),
        ]));
    }

    #[Route('/api/institution-taxpayers', name: 'api_institution_taxpayers_create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return $this->cors(new JsonResponse(['message' => 'Datele trimise nu sunt valide.'], 400));
        }

        $result = $this->createFromPayload($payload, $entityManager);

        if (($result['status'] ?? null) === 'duplicate') {
            return $this->cors(new JsonResponse(['message' => 'Inregistrarea exista deja pentru aceasta institutie.'], 409));
        }

        if (($result['status'] ?? null) === 'invalid') {
            return $this->cors(new JsonResponse(['message' => $result['message'] ?? 'Datele contribuabilului nu sunt valide.'], 422));
        }

        $entityManager->flush();

        return $this->cors(new JsonResponse([
            'message' => 'Cetateanul a fost salvat in baza institutiei.',
            'item' => $this->serializeTaxpayer($result['item']),
            'summary' => $this->summary($entityManager, (int) $payload['institutionId']),
        ], 201));
    }

    #[Route('/api/institution-taxpayers/import', name: 'api_institution_taxpayers_import', methods: ['POST'])]
    public function import(Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload) || !is_array($payload['records'] ?? null)) {
            return $this->cors(new JsonResponse(['message' => 'Fisierul importat nu contine inregistrari valide.'], 400));
        }

        $imported = 0;
        $skipped = 0;
        $institutionId = (int) ($payload['institutionId'] ?? 0);

        foreach ($payload['records'] as $record) {
            if (!is_array($record)) {
                $skipped += 1;
                continue;
            }

            $result = $this->createFromPayload([
                ...$record,
                'institutionId' => $institutionId,
            ], $entityManager);

            if (($result['status'] ?? null) === 'created') {
                $imported += 1;
            } else {
                $skipped += 1;
            }
        }

        $entityManager->flush();

        return $this->cors(new JsonResponse([
            'message' => sprintf('Import finalizat: %d inregistrari adaugate%s.', $imported, $skipped > 0 ? sprintf(', %d duplicate sau invalide sarite', $skipped) : ''),
            'imported' => $imported,
            'skipped' => $skipped,
            'summary' => $this->summary($entityManager, $institutionId),
        ]));
    }

    /**
     * @param array<string, mixed> $payload
     *
     * @return array{status: string, message?: string, item?: InstitutionTaxpayer}
     */
    private function createFromPayload(array $payload, EntityManagerInterface $entityManager): array
    {
        $institutionId = (int) ($payload['institutionId'] ?? 0);
        $type = ((string) ($payload['type'] ?? 'person')) === 'company' ? 'company' : 'person';
        $identifier = $this->normalizeIdentifier((string) ($payload['identifier'] ?? $payload['cnp'] ?? $payload['cif'] ?? $payload['cnp_cui'] ?? ''));
        $name = trim((string) ($payload['name'] ?? ''));

        if ($name === '' && $type === 'person') {
            $name = trim(sprintf('%s %s', $payload['lastName'] ?? $payload['nume'] ?? '', $payload['firstName'] ?? $payload['prenume'] ?? ''));
        }

        if ($institutionId <= 0 || $identifier === '' || $name === '') {
            return ['status' => 'invalid', 'message' => 'Institutia, numele si CNP/CUI sunt obligatorii.'];
        }

        $existing = $entityManager->getRepository(InstitutionTaxpayer::class)->findOneBy([
            'institutionId' => $institutionId,
            'type' => $type,
            'identifier' => $identifier,
        ]);

        if ($existing instanceof InstitutionTaxpayer) {
            return ['status' => 'duplicate'];
        }

        $matchedUser = $this->matchUser($entityManager, $type, $identifier);
        $address = $this->formatAddress($payload);

        $taxpayer = (new InstitutionTaxpayer())
            ->setInstitutionId($institutionId)
            ->setCorrespondenceId((string) ($payload['correspondenceId'] ?? $payload['idCorespondenta'] ?? ''))
            ->setType($type)
            ->setName($name)
            ->setIdentifier($identifier)
            ->setLocality(trim((string) ($payload['locality'] ?? $payload['localitate'] ?? '')))
            ->setEmail((string) ($payload['email'] ?? ''))
            ->setPhone((string) ($payload['phone'] ?? $payload['telefon'] ?? ''))
            ->setAccountKind((string) ($payload['accountKind'] ?? $payload['tip_cont'] ?? ''))
            ->setAddress($address)
            ->setLinkedUserId($matchedUser?->getId())
            ->setStatus($matchedUser instanceof User ? 'legat' : 'nelegat')
            ->setDetails([
                'raw' => $payload,
                'address' => $address,
            ]);

        try {
            $entityManager->persist($taxpayer);
        } catch (UniqueConstraintViolationException) {
            return ['status' => 'duplicate'];
        }

        return ['status' => 'created', 'item' => $taxpayer];
    }

    private function matchUser(EntityManagerInterface $entityManager, string $type, string $identifier): ?User
    {
        foreach ($entityManager->getRepository(User::class)->findAll() as $user) {
            if (!$user instanceof User) {
                continue;
            }

            $profile = $user->getProfile();
            if (!$profile instanceof \App\Entity\Profile) {
                continue;
            }

            if ($type === 'company' && $profile->getPersonType() === 'company' && $this->normalizeIdentifier((string) $profile->getTaxIdentifier()) === $identifier) {
                return $user;
            }

            $optionalFields = $profile->getOptionalFields();
            if ($type === 'person' && $profile->getPersonType() === 'individual' && $this->normalizeIdentifier((string) ($optionalFields['cnp'] ?? '')) === $identifier) {
                return $user;
            }
        }

        return null;
    }

    /**
     * @return array<string, int>
     */
    private function summary(EntityManagerInterface $entityManager, int $institutionId): array
    {
        if ($institutionId <= 0) {
            return ['total' => 0, 'persons' => 0, 'companies' => 0, 'active' => 0];
        }

        $repository = $entityManager->getRepository(InstitutionTaxpayer::class);

        return [
            'total' => $repository->count(['institutionId' => $institutionId]),
            'persons' => $repository->count(['institutionId' => $institutionId, 'type' => 'person']),
            'companies' => $repository->count(['institutionId' => $institutionId, 'type' => 'company']),
            'active' => $repository->count(['institutionId' => $institutionId, 'status' => 'legat']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTaxpayer(InstitutionTaxpayer $taxpayer): array
    {
        return [
            'id' => (string) $taxpayer->getId(),
            'institutionId' => $taxpayer->getInstitutionId(),
            'correspondenceId' => $taxpayer->getCorrespondenceId(),
            'type' => $taxpayer->getType(),
            'name' => $taxpayer->getName(),
            'identifier' => $taxpayer->getIdentifier(),
            'locality' => $taxpayer->getLocality(),
            'status' => $taxpayer->getStatus(),
            'linkedUserId' => $taxpayer->getLinkedUserId(),
            'email' => $taxpayer->getEmail(),
            'phone' => $taxpayer->getPhone(),
            'accountKind' => $taxpayer->getAccountKind(),
            'address' => $taxpayer->getAddress(),
            'details' => $taxpayer->getDetails(),
            'createdAt' => $taxpayer->getCreatedAt()->format(DATE_ATOM),
        ];
    }

    private function normalizeIdentifier(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function formatAddress(array $payload): string
    {
        $parts = [
            $payload['street'] ?? $payload['strada'] ?? '',
            $payload['streetNumber'] ?? $payload['nr_strada'] ?? '',
            $payload['buildingNumber'] ?? $payload['nr_cladire'] ?? '',
            $payload['floor'] ?? $payload['etaj'] ?? '',
            $payload['apartment'] ?? $payload['apartament'] ?? '',
            $payload['locality'] ?? $payload['localitate'] ?? '',
            $payload['county'] ?? $payload['judet'] ?? '',
            $payload['postalCode'] ?? $payload['cod_postal'] ?? '',
        ];

        return implode(', ', array_values(array_filter(array_map(fn ($part) => trim((string) $part), $parts))));
    }

    private function cors(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Access-Control-Allow-Origin', 'http://localhost:13000');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        return $response;
    }
}
