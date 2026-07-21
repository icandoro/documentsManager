<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260721120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create institution_taxpayers table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE institution_taxpayers (
                id INT UNSIGNED AUTO_INCREMENT NOT NULL,
                institution_id VARCHAR(64) NOT NULL,
                type VARCHAR(16) NOT NULL,
                name VARCHAR(180) NOT NULL,
                identifier VARCHAR(32) NOT NULL,
                locality VARCHAR(120) NOT NULL,
                status VARCHAR(16) NOT NULL,
                linked_user_id INT UNSIGNED DEFAULT NULL,
                email VARCHAR(180) DEFAULT NULL,
                phone VARCHAR(32) DEFAULT NULL,
                account_kind VARCHAR(48) DEFAULT NULL,
                address LONGTEXT DEFAULT NULL,
                details JSON NOT NULL,
                created_at DATETIME NOT NULL,
                UNIQUE INDEX uniq_institution_taxpayer_identifier (institution_id, type, identifier),
                INDEX idx_institution_taxpayers_linked_user (linked_user_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql(<<<'SQL'
            ALTER TABLE institution_taxpayers
            ADD CONSTRAINT fk_institution_taxpayers_linked_user
            FOREIGN KEY (linked_user_id) REFERENCES users (id) ON DELETE SET NULL
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE institution_taxpayers DROP FOREIGN KEY fk_institution_taxpayers_linked_user');
        $this->addSql('DROP TABLE institution_taxpayers');
    }
}
