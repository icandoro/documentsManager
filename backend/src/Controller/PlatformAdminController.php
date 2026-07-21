<?php

namespace App\Controller;

use App\Service\ClientCodeGenerator;
use App\Service\InstitutionSlugGenerator;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\KernelInterface;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/platform-admin')]
class PlatformAdminController extends AbstractController
{
    private const ROLE_PRESETS = [
        'superadmin_full' => [
            'label' => 'Superadmin full access',
            'capabilities' => [
                'platform.full',
                'platform.users.read',
                'platform.users.write',
                'platform.roles.write',
                'platform.institutions.read',
                'platform.institutions.write',
                'platform.institutions.approve',
                'platform.audit.read',
            ],
        ],
        'platform_editor' => [
            'label' => 'Administrator editare',
            'capabilities' => [
                'platform.users.read',
                'platform.users.write',
                'platform.institutions.read',
                'platform.institutions.write',
                'platform.institutions.approve',
                'platform.audit.read',
            ],
        ],
        'institution_reviewer' => [
            'label' => 'Reviewer institutii',
            'capabilities' => [
                'platform.institutions.read',
                'platform.institutions.approve',
                'platform.audit.read',
            ],
        ],
        'platform_readonly' => [
            'label' => 'Citire si audit',
            'capabilities' => [
                'platform.users.read',
                'platform.institutions.read',
                'platform.audit.read',
            ],
        ],
    ];

    #[Route('/security/roles', name: 'platform_admin_security_roles', methods: ['GET'])]
    public function roles(): JsonResponse
    {
        return $this->json([
            'roles' => self::ROLE_PRESETS,
        ]);
    }

    #[Route('/users', name: 'platform_admin_users', methods: ['GET'])]
    public function users(Connection $connection): JsonResponse
    {
        $rows = $connection->fetchAllAssociative(
            'SELECT u.id, u.email, u.account_code, u.roles, p.first_name, p.last_name, p.phone, p.person_type, p.company_name, p.tax_identifier, p.optional_fields
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             ORDER BY u.id ASC'
        );

        $admins = array_values(array_filter(array_map(fn (array $row) => $this->serializeAdminUser($row), $rows)));

        return $this->json([
            'users' => $admins,
            'total' => count($admins),
        ]);
    }

    #[Route('/users/{id}/access', name: 'platform_admin_user_access', methods: ['POST'])]
    public function updateUserAccess(int $id, Request $request, Connection $connection): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['message' => 'Payload invalid.'], 400);
        }

        $presetId = (string) ($payload['presetId'] ?? 'platform_readonly');
        $preset = self::ROLE_PRESETS[$presetId] ?? self::ROLE_PRESETS['platform_readonly'];
        $status = (string) ($payload['status'] ?? 'activ');
        $roles = $presetId === 'superadmin_full'
            ? ['ROLE_USER', 'ROLE_SUPER_ADMIN']
            : ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_PLATFORM_ADMIN'];

        $connection->update('users', [
            'roles' => json_encode($roles, JSON_THROW_ON_ERROR),
        ], ['id' => $id]);

        $profile = $connection->fetchAssociative('SELECT id, optional_fields FROM profiles WHERE user_id = ?', [$id]);
        if ($profile) {
            $optionalFields = $this->decodeJson($profile['optional_fields'] ?? '{}');
            $optionalFields['adminAccess'] = [
                'presetId' => $presetId,
                'label' => $preset['label'],
                'capabilities' => $preset['capabilities'],
                'updatedAt' => (new \DateTimeImmutable())->format(DATE_ATOM),
            ];
            $optionalFields['status'] = $status;

            $connection->update('profiles', [
                'optional_fields' => json_encode($optionalFields, JSON_THROW_ON_ERROR),
            ], ['id' => $profile['id']]);
        }

        return $this->json([
            'message' => 'Accesul administratorului a fost actualizat.',
            'access' => [
                'presetId' => $presetId,
                'capabilities' => $preset['capabilities'],
                'status' => $status,
            ],
        ]);
    }

    #[Route('/institutions', name: 'platform_admin_institutions', methods: ['GET'])]
    public function institutions(Connection $connection): JsonResponse
    {
        $rows = $connection->fetchAllAssociative(
            'SELECT u.id, u.email, u.roles, p.first_name, p.last_name, p.phone, p.person_type, p.company_name, p.tax_identifier, p.optional_fields
             FROM users u
             INNER JOIN profiles p ON p.user_id = u.id
             WHERE p.person_type = ?
             ORDER BY u.id DESC',
            ['institution']
        );

        return $this->json([
            'institutions' => array_map(fn (array $row) => $this->serializeInstitution($row), $rows),
            'total' => count($rows),
        ]);
    }

    #[Route('/institutions/{id}/status', name: 'platform_admin_institution_status', methods: ['POST'])]
    public function updateInstitutionStatus(int $id, Request $request, Connection $connection): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['message' => 'Payload invalid.'], 400);
        }

        $status = (string) ($payload['status'] ?? 'activ');
        if (!in_array($status, ['activ', 'in_verificare', 'suspendat'], true)) {
            return $this->json(['message' => 'Status invalid.'], 422);
        }

        $profile = $connection->fetchAssociative('SELECT id, optional_fields FROM profiles WHERE user_id = ?', [$id]);
        if (!$profile) {
            return $this->json(['message' => 'Institutia nu a fost gasita.'], 404);
        }

        $optionalFields = $this->decodeJson($profile['optional_fields'] ?? '{}');
        $optionalFields['status'] = $status;
        $optionalFields['institutionApproval'] = [
            'status' => $status,
            'updatedAt' => (new \DateTimeImmutable())->format(DATE_ATOM),
        ];

        $connection->update('profiles', [
            'optional_fields' => json_encode($optionalFields, JSON_THROW_ON_ERROR),
        ], ['id' => $profile['id']]);

        return $this->json([
            'message' => 'Statusul institutiei a fost actualizat.',
            'status' => $status,
        ]);
    }

    #[Route('/all-users', name: 'platform_admin_all_users', methods: ['GET'])]
    public function allUsers(Request $request, Connection $connection, InstitutionSlugGenerator $slugGenerator, ClientCodeGenerator $clientCodeGenerator): JsonResponse
    {
        $rows = $connection->fetchAllAssociative(
            'SELECT u.id, u.email, u.account_code, u.roles, p.first_name, p.last_name, p.phone, p.person_type, p.company_name, p.tax_identifier, p.optional_fields
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             ORDER BY u.id DESC'
        );

        $institutions = [];
        foreach ($rows as $row) {
            if (($row['person_type'] ?? null) !== 'institution') {
                continue;
            }

            $name = trim((string) ($row['company_name'] ?? '')) ?: (string) $row['email'];
            $slug = $slugGenerator->fromNameAndCif($name, (string) ($row['tax_identifier'] ?? ''));
            $institutions[$slug] = $name;
        }

        $allUsers = array_map(function (array $row) use ($institutions, $clientCodeGenerator): array {
            $optionalFields = $this->decodeJson($row['optional_fields'] ?? '{}');
            $personType = $row['person_type'] ?? 'individual';
            $name = $personType === 'institution' || $personType === 'company'
                ? trim((string) ($row['company_name'] ?? ''))
                : trim(($row['last_name'] ?? '').' '.($row['first_name'] ?? ''));
            $linkedInstitutionIds = array_values(array_filter(
                is_array($optionalFields['linkedInstitutionIds'] ?? null) ? $optionalFields['linkedInstitutionIds'] : []
            ));
            $address = is_array($optionalFields['address'] ?? null) ? $optionalFields['address'] : [];
            $company = is_array($optionalFields['company'] ?? null) ? $optionalFields['company'] : [];
            $locality = trim((string) ($address['city'] ?? $company['locality'] ?? ''));
            $county = trim((string) ($address['county'] ?? $company['county'] ?? ''));

            return [
                'id' => (int) $row['id'],
                'email' => $row['email'],
                'name' => $name !== '' ? $name : $row['email'],
                'phone' => $row['phone'] ?? null,
                'accountType' => $personType,
                'status' => $optionalFields['status'] ?? 'activ',
                'locality' => $locality,
                'county' => $county,
                'cif' => $row['tax_identifier'] ?? null,
                'clientCode' => in_array($personType, ['individual', 'company'], true)
                    ? $clientCodeGenerator->fromAccountCode((string) $row['account_code'])
                    : null,
                'linkedInstitutionIds' => $linkedInstitutionIds,
                'linkedInstitutionNames' => array_values(array_filter(array_map(
                    fn (string $slug) => $institutions[$slug] ?? null,
                    $linkedInstitutionIds
                ))),
            ];
        }, $rows);

        $query = mb_strtolower(trim((string) $request->query->get('q', '')));
        $accountType = (string) $request->query->get('accountType', 'all');
        $institutionFilter = (string) $request->query->get('institution', 'all');
        $county = (string) $request->query->get('county', 'all');
        $locality = (string) $request->query->get('locality', 'all');

        $filtered = array_values(array_filter($allUsers, function (array $user) use ($query, $accountType, $institutionFilter, $county, $locality): bool {
            if ($accountType !== 'all' && $user['accountType'] !== $accountType) {
                return false;
            }

            if ($institutionFilter === 'independent' && $user['linkedInstitutionIds'] !== []) {
                return false;
            }

            if (!in_array($institutionFilter, ['all', 'independent'], true) && !in_array($institutionFilter, $user['linkedInstitutionIds'], true)) {
                return false;
            }

            if ($county !== 'all' && $user['county'] !== $county) {
                return false;
            }

            if ($locality !== 'all' && $user['locality'] !== $locality) {
                return false;
            }

            if ($query !== '') {
                $haystack = mb_strtolower(implode(' ', [$user['name'], $user['email'], $user['locality'], $user['county'], $user['clientCode'] ?? '', ...$user['linkedInstitutionNames']]));

                if (!str_contains($haystack, $query)) {
                    return false;
                }
            }

            return true;
        }));

        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(50, max(1, (int) $request->query->get('limit', 20)));
        $total = count($filtered);
        $totalPages = max(1, (int) ceil($total / $limit));
        $page = min($page, $totalPages);
        $pageItems = array_slice($filtered, ($page - 1) * $limit, $limit);

        return $this->json([
            'users' => $pageItems,
            'institutions' => array_map(
                fn (string $slug, string $name) => ['slug' => $slug, 'name' => $name],
                array_keys($institutions),
                array_values($institutions)
            ),
            'counties' => array_values(array_unique(array_filter(array_column($allUsers, 'county')))),
            'localities' => array_values(array_unique(array_filter(array_column($allUsers, 'locality')))),
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'totalPages' => $totalPages,
        ]);
    }

    #[Route('/users/{id}', name: 'platform_admin_user_delete', methods: ['DELETE'])]
    public function deleteUser(int $id, Connection $connection, InstitutionSlugGenerator $slugGenerator, KernelInterface $kernel): JsonResponse
    {
        $row = $connection->fetchAssociative(
            'SELECT u.id, p.person_type, p.company_name, p.tax_identifier
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.id = ?',
            [$id]
        );

        if (!$row) {
            return $this->json(['message' => 'Utilizatorul nu a fost gasit.'], 404);
        }

        if (($row['person_type'] ?? null) === 'institution') {
            $name = trim((string) ($row['company_name'] ?? ''));
            $slug = $slugGenerator->fromNameAndCif($name, (string) ($row['tax_identifier'] ?? ''));
            $connection->executeStatement('DELETE FROM institution_taxpayers WHERE institution_id = ?', [$slug]);
        }

        // documents, profile, document_packages and document_package_items all
        // cascade off users.id via ON DELETE CASCADE foreign keys.
        $connection->delete('users', ['id' => $id]);

        $projectDir = $kernel->getProjectDir();
        $this->removeDirectoryRecursively(sprintf('%s/var/uploads/documents/%d', $projectDir, $id));
        $this->removeDirectoryRecursively(sprintf('%s/var/uploads/institutions/%d', $projectDir, $id));

        return $this->json([
            'message' => ($row['person_type'] ?? null) === 'institution'
                ? 'Institutia, documentele si cetatenii inrolati au fost sterse.'
                : 'Utilizatorul si documentele asociate au fost sterse.',
        ]);
    }

    private function removeDirectoryRecursively(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }

        foreach (scandir($path) ?: [] as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $itemPath = $path.'/'.$item;

            if (is_dir($itemPath)) {
                $this->removeDirectoryRecursively($itemPath);
            } else {
                @unlink($itemPath);
            }
        }

        @rmdir($path);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function serializeAdminUser(array $row): ?array
    {
        $roles = $this->decodeJson($row['roles'] ?? '[]');
        if (!array_intersect($roles, ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_PLATFORM_ADMIN'])) {
            return null;
        }

        $optionalFields = $this->decodeJson($row['optional_fields'] ?? '{}');
        $access = $optionalFields['adminAccess'] ?? null;
        $presetId = is_array($access) ? ($access['presetId'] ?? null) : null;

        return [
            'id' => (int) $row['id'],
            'email' => $row['email'],
            'name' => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')) ?: $row['email'],
            'role' => in_array('ROLE_SUPER_ADMIN', $roles, true) ? 'superadmin' : 'admin',
            'presetId' => $presetId ?? (in_array('ROLE_SUPER_ADMIN', $roles, true) ? 'superadmin_full' : 'platform_readonly'),
            'capabilities' => is_array($access) ? ($access['capabilities'] ?? []) : [],
            'status' => $optionalFields['status'] ?? 'activ',
            'phone' => $row['phone'] ?? null,
            'accountCode' => $row['account_code'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeInstitution(array $row): array
    {
        $optionalFields = $this->decodeJson($row['optional_fields'] ?? '{}');

        return [
            'id' => (int) $row['id'],
            'email' => $row['email'],
            'name' => $row['company_name'] ?: trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')) ?: $row['email'],
            'cif' => $row['tax_identifier'] ?? null,
            'phone' => $row['phone'] ?? null,
            'status' => $optionalFields['status'] ?? 'in_verificare',
            'approval' => $optionalFields['institutionApproval'] ?? null,
            'documents' => $optionalFields['onboardingDocuments'] ?? [],
        ];
    }

    /**
     * @return array<mixed>
     */
    private function decodeJson(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (!is_string($value) || $value === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }
}
