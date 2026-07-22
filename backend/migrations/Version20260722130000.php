<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use App\Service\InstitutionSlugGenerator;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260722130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Backfill profiles.optional_fields linkedInstitutionIds/requestedInstitutionIds from name-derived slugs to stable institution user ids';
    }

    public function up(Schema $schema): void
    {
        $slugGenerator = new InstitutionSlugGenerator();

        $institutionRows = $this->connection->fetchAllAssociative(
            "SELECT u.id, p.company_name, p.tax_identifier
             FROM users u
             INNER JOIN profiles p ON p.user_id = u.id
             WHERE p.person_type = 'institution'"
        );

        $slugToId = [];
        foreach ($institutionRows as $row) {
            $name = trim((string) ($row['company_name'] ?? ''));
            $slug = $slugGenerator->fromNameAndCif($name, (string) ($row['tax_identifier'] ?? ''));

            if ($slug !== '') {
                $slugToId[$slug] = (string) $row['id'];
            }
        }

        $profiles = $this->connection->fetchAllAssociative('SELECT id, optional_fields FROM profiles');

        foreach ($profiles as $profile) {
            $optionalFields = json_decode((string) ($profile['optional_fields'] ?? '{}'), true);

            if (!is_array($optionalFields)) {
                continue;
            }

            $changed = false;

            foreach (['linkedInstitutionIds', 'requestedInstitutionIds'] as $field) {
                if (!is_array($optionalFields[$field] ?? null)) {
                    continue;
                }

                $resolved = [];
                foreach ($optionalFields[$field] as $value) {
                    $value = (string) $value;

                    if (ctype_digit($value)) {
                        $resolved[] = $value;
                    } elseif (isset($slugToId[$value])) {
                        $resolved[] = $slugToId[$value];
                    }
                    // Unresolvable legacy slugs (renamed/deleted institutions) are dropped.
                }

                $resolved = array_values(array_unique($resolved));

                if ($resolved !== $optionalFields[$field]) {
                    $optionalFields[$field] = $resolved;
                    $changed = true;
                }
            }

            if ($changed) {
                $this->addSql(
                    'UPDATE profiles SET optional_fields = ? WHERE id = ?',
                    [json_encode($optionalFields, JSON_THROW_ON_ERROR), $profile['id']]
                );
            }
        }
    }

    public function down(Schema $schema): void
    {
        // One-way data cleanup: the original slug values are not recoverable
        // (institution names may have changed since), so there is no
        // meaningful rollback beyond leaving the numeric ids in place.
    }
}
