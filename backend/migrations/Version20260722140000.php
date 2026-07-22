<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260722140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Split institutions out of users into their own table, so multiple staff logins can belong to one institution';
    }

    /**
     * This migration reads back generated ids (institutions.id) mid-flight to
     * populate dependent rows, so it runs everything through the connection
     * directly rather than via addSql()'s queue-and-run-after-up() model.
     */
    public function isTransactional(): bool
    {
        return false;
    }

    public function up(Schema $schema): void
    {
        $this->connection->executeStatement(<<<'SQL'
            CREATE TABLE institutions (
                id INT UNSIGNED AUTO_INCREMENT NOT NULL,
                name VARCHAR(180) NOT NULL,
                cif VARCHAR(32) NOT NULL,
                locality VARCHAR(120) DEFAULT NULL,
                county VARCHAR(120) DEFAULT NULL,
                address LONGTEXT DEFAULT NULL,
                phone VARCHAR(32) DEFAULT NULL,
                contact_email VARCHAR(180) DEFAULT NULL,
                status VARCHAR(16) NOT NULL DEFAULT 'in_verificare',
                onboarding_status VARCHAR(48) DEFAULT NULL,
                onboarding_documents JSON NOT NULL,
                created_at DATETIME NOT NULL,
                UNIQUE INDEX uniq_institutions_cif (cif),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->connection->executeStatement('ALTER TABLE profiles ADD institution_id INT UNSIGNED DEFAULT NULL');

        // One institutions row per existing institution-type user, then point
        // that same profile at the institution it now owns.
        $institutionUsers = $this->connection->fetchAllAssociative(
            "SELECT u.id AS user_id, u.email, p.id AS profile_id, p.company_name, p.tax_identifier, p.optional_fields
             FROM users u
             INNER JOIN profiles p ON p.user_id = u.id
             WHERE p.person_type = 'institution'"
        );

        /** @var array<int, int> $userIdToInstitutionId */
        $userIdToInstitutionId = [];

        foreach ($institutionUsers as $row) {
            $optionalFields = json_decode((string) ($row['optional_fields'] ?? '{}'), true);
            $optionalFields = is_array($optionalFields) ? $optionalFields : [];
            $company = is_array($optionalFields['company'] ?? null) ? $optionalFields['company'] : [];
            $address = is_array($optionalFields['address'] ?? null) ? $optionalFields['address'] : [];

            $name = trim((string) ($row['company_name'] ?? $company['name'] ?? '')) ?: (string) $row['email'];
            $cif = preg_replace('/\D+/', '', (string) ($row['tax_identifier'] ?? $company['cif'] ?? '')) ?? '';
            $cif = $cif !== '' ? $cif : ('unk-'.$row['user_id']);

            $this->connection->executeStatement(
                'INSERT INTO institutions (name, cif, locality, county, address, phone, contact_email, status, onboarding_status, onboarding_documents, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                [
                    $name,
                    $cif,
                    $address['city'] ?? null,
                    $address['county'] ?? null,
                    $company['address'] ?? null,
                    $optionalFields['phone'] ?? null,
                    $row['email'],
                    $optionalFields['status'] ?? 'in_verificare',
                    $optionalFields['onboardingStatus'] ?? null,
                    json_encode($optionalFields['onboardingDocuments'] ?? [], JSON_THROW_ON_ERROR),
                ]
            );

            $institutionId = (int) $this->connection->lastInsertId();
            $userIdToInstitutionId[(int) $row['user_id']] = $institutionId;

            $this->connection->executeStatement('UPDATE profiles SET institution_id = ? WHERE id = ?', [$institutionId, $row['profile_id']]);
        }

        $this->connection->executeStatement('ALTER TABLE profiles ADD CONSTRAINT fk_profiles_institution FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE CASCADE');

        // institution_taxpayers.institution_user_id held a staff user's id;
        // repoint it at that user's institution instead.
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers ADD institution_id_new INT UNSIGNED DEFAULT NULL');

        foreach ($userIdToInstitutionId as $userId => $institutionId) {
            $this->connection->executeStatement(
                'UPDATE institution_taxpayers SET institution_id_new = ? WHERE institution_user_id = ?',
                [$institutionId, $userId]
            );
        }

        $this->connection->executeStatement('DELETE FROM institution_taxpayers WHERE institution_id_new IS NULL');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers DROP FOREIGN KEY fk_institution_taxpayers_institution');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers DROP INDEX uniq_institution_taxpayer_identifier');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers DROP COLUMN institution_user_id');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers CHANGE institution_id_new institution_id INT UNSIGNED NOT NULL');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers ADD UNIQUE INDEX uniq_institution_taxpayer_identifier (institution_id, type, identifier)');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers ADD CONSTRAINT fk_institution_taxpayers_institution FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers DROP FOREIGN KEY fk_institution_taxpayers_institution');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers DROP INDEX uniq_institution_taxpayer_identifier');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers ADD institution_user_id INT UNSIGNED DEFAULT NULL');
        $this->connection->executeStatement(
            'UPDATE institution_taxpayers it
             INNER JOIN profiles p ON p.institution_id = it.institution_id
             SET it.institution_user_id = p.user_id'
        );
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers DROP COLUMN institution_id');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers CHANGE institution_user_id institution_user_id INT UNSIGNED NOT NULL');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers ADD UNIQUE INDEX uniq_institution_taxpayer_identifier (institution_user_id, type, identifier)');
        $this->connection->executeStatement('ALTER TABLE institution_taxpayers ADD CONSTRAINT fk_institution_taxpayers_institution FOREIGN KEY (institution_user_id) REFERENCES users (id) ON DELETE CASCADE');

        $this->connection->executeStatement('ALTER TABLE profiles DROP FOREIGN KEY fk_profiles_institution');
        $this->connection->executeStatement('ALTER TABLE profiles DROP COLUMN institution_id');
        $this->connection->executeStatement('DROP TABLE institutions');
    }
}
