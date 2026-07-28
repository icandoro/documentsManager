<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260728213254 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE institution_taxpayers DROP FOREIGN KEY `fk_institution_taxpayers_institution`');
        $this->addSql('DROP INDEX IDX_BC77ED4210405986 ON institution_taxpayers');
        $this->addSql('ALTER TABLE institution_taxpayers CHANGE accountKind account_kind VARCHAR(48) DEFAULT NULL');
        $this->addSql('ALTER TABLE institutions CHANGE status status VARCHAR(16) NOT NULL');
        $this->addSql('ALTER TABLE profiles DROP FOREIGN KEY `fk_profiles_institution`');
        $this->addSql('DROP INDEX fk_profiles_institution ON profiles');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE institutions CHANGE status status VARCHAR(16) DEFAULT \'in_verificare\' NOT NULL');
        $this->addSql('ALTER TABLE institution_taxpayers CHANGE account_kind accountKind VARCHAR(48) DEFAULT NULL');
        $this->addSql('ALTER TABLE institution_taxpayers ADD CONSTRAINT `fk_institution_taxpayers_institution` FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_BC77ED4210405986 ON institution_taxpayers (institution_id)');
        $this->addSql('ALTER TABLE profiles ADD CONSTRAINT `fk_profiles_institution` FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX fk_profiles_institution ON profiles (institution_id)');
    }
}
