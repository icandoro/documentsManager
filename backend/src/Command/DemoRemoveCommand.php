<?php

namespace App\Command;

use App\Entity\Institution;
use App\Entity\User;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:demo:remove', description: 'Permanently delete only the seeded demo accounts (and their demo institution), leaving real accounts untouched.')]
final class DemoRemoveCommand extends Command
{
    private const DEMO_EMAILS = [
        'superadmin@docmanager.local',
        'pf.demo@docmanager.local',
        'pj.demo@docmanager.local',
        'primaria.joita@docmanager.local',
    ];

    private const DEMO_INSTITUTION_CIF = '12345678';
    private const DEMO_INSTITUTION_NAME = 'Primaria Joita';

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly Connection $connection,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $userIds = [];

        foreach (self::DEMO_EMAILS as $email) {
            $user = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $email]);

            if (!$user instanceof User) {
                continue;
            }

            $userIds[] = (int) $user->getId();
            $this->entityManager->remove($user);
            $io->text(sprintf('Sters contul demo: %s', $email));
        }

        $institution = $this->entityManager->getRepository(Institution::class)->findOneBy([
            'cif' => self::DEMO_INSTITUTION_CIF,
            'name' => self::DEMO_INSTITUTION_NAME,
        ]);
        $institutionId = $institution?->getId();

        if ($institution instanceof Institution) {
            $this->entityManager->remove($institution);
            $io->text(sprintf('Stearsa institutia demo: %s', self::DEMO_INSTITUTION_NAME));
        }

        $this->entityManager->flush();

        // institution_taxpayers has no Doctrine relation (plain int columns), so
        // clean up the roster rows the demo seed created by hand.
        if ($userIds !== []) {
            $this->connection->executeStatement(
                'DELETE FROM institution_taxpayers WHERE linked_user_id IN ('.implode(',', array_fill(0, count($userIds), '?')).')',
                $userIds,
            );
        }

        if ($institutionId !== null) {
            $this->connection->executeStatement(
                'DELETE FROM institution_taxpayers WHERE institution_id = ?',
                [$institutionId],
            );
        }

        if ($userIds === [] && !$institution instanceof Institution) {
            $io->success('Nu au fost gasite conturi sau institutii demo - nu era nimic de sters.');

            return Command::SUCCESS;
        }

        $io->success('Conturile demo au fost sterse definitiv. Conturile reale nu au fost atinse.');

        return Command::SUCCESS;
    }
}
