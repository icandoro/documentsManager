<?php

namespace App\Command;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:schema:update', description: 'Create or update the database schema from Doctrine ORM metadata.')]
final class SchemaUpdateCommand extends Command
{
    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $metadata = $this->entityManager->getMetadataFactory()->getAllMetadata();

        if ($metadata === []) {
            $io->warning('No Doctrine metadata found.');

            return Command::SUCCESS;
        }

        $schemaTool = new SchemaTool($this->entityManager);
        $schemaTool->updateSchema($metadata);

        $io->success('Database schema is in sync with Doctrine ORM metadata.');

        return Command::SUCCESS;
    }
}
