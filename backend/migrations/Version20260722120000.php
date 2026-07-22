<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use App\Service\InstitutionSlugGenerator;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260722120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Replace institution_taxpayers.institution_id (name-derived slug) with a stable institution_user_id foreign key, and add correspondence_id';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE institution_taxpayers ADD institution_user_id INT UNSIGNED DEFAULT NULL, ADD correspondence_id VARCHAR(64) DEFAULT NULL');

        $slugGenerator = new InstitutionSlugGenerator();
        $institutions = $this->connection->fetchAllAssociative(
            "SELECT u.id, p.company_name, p.tax_identifier
             FROM users u
             INNER JOIN profiles p ON p.user_id = u.id
             WHERE p.person_type = 'institution'"
        );

        foreach ($institutions as $institution) {
            $name = trim((string) ($institution['company_name'] ?? ''));
            $slug = $slugGenerator->fromNameAndCif($name, (string) ($institution['tax_identifier'] ?? ''));

            if ($slug === '') {
                continue;
            }

            $this->addSql(
                'UPDATE institution_taxpayers SET institution_user_id = ? WHERE institution_id = ?',
                [$institution['id'], $slug]
            );
        }

        // Any roster row whose slug no longer matches a real institution
        // (renamed/deleted institution) can't carry a valid FK; drop it
        // rather than leave orphaned, unmapped rows behind.
        $this->addSql('DELETE FROM institution_taxpayers WHERE institution_user_id IS NULL');

        $this->addSql('ALTER TABLE institution_taxpayers MODIFY institution_user_id INT UNSIGNED NOT NULL');
        $this->addSql('ALTER TABLE institution_taxpayers DROP INDEX uniq_institution_taxpayer_identifier');
        $this->addSql('ALTER TABLE institution_taxpayers DROP COLUMN institution_id');
        $this->addSql('ALTER TABLE institution_taxpayers ADD UNIQUE INDEX uniq_institution_taxpayer_identifier (institution_user_id, type, identifier)');
        $this->addSql('ALTER TABLE institution_taxpayers ADD CONSTRAINT fk_institution_taxpayers_institution FOREIGN KEY (institution_user_id) REFERENCES users (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE institution_taxpayers DROP FOREIGN KEY fk_institution_taxpayers_institution');
        $this->addSql('ALTER TABLE institution_taxpayers DROP INDEX uniq_institution_taxpayer_identifier');
        $this->addSql('ALTER TABLE institution_taxpayers ADD institution_id VARCHAR(64) DEFAULT NULL');
        $this->addSql('ALTER TABLE institution_taxpayers ADD UNIQUE INDEX uniq_institution_taxpayer_identifier (institution_id, type, identifier)');
        $this->addSql('ALTER TABLE institution_taxpayers DROP COLUMN institution_user_id, DROP COLUMN correspondence_id');
    }
}
