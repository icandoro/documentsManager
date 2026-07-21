<?php

namespace App\Command;

use App\Entity\Profile;
use App\Entity\User;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsCommand(name: 'app:demo:reset', description: 'Reset all application data and recreate the default demo accounts.')]
final class DemoResetCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly Connection $connection,
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $this->connection->executeStatement('SET FOREIGN_KEY_CHECKS=0');
        foreach (['document_package_items', 'document_packages', 'documents', 'institution_taxpayers', 'profiles', 'users'] as $table) {
            if ($this->tableExists($table)) {
                $this->connection->executeStatement(sprintf('TRUNCATE TABLE %s', $table));
            }
        }
        $this->connection->executeStatement('SET FOREIGN_KEY_CHECKS=1');

        foreach ($this->demoAccounts() as $account) {
            $user = new User(null, $account['email'], '', $account['roles'], $account['accountCode']);
            $user->setPassword($this->passwordHasher->hashPassword($user, $account['password']));

            $profile = (new Profile())
                ->setUser($user)
                ->setFirstName($account['firstName'])
                ->setLastName($account['lastName'])
                ->setPersonType($account['personType'])
                ->setCompanyName($account['companyName'])
                ->setTaxIdentifier($account['taxIdentifier'])
                ->setOptionalFields($account['optionalFields']);

            $user->setProfile($profile);
            $this->entityManager->persist($user);
            $this->entityManager->persist($profile);
        }

        $this->entityManager->flush();

        $io->success('Demo database was reset. Created only the 5 login demo accounts. Citizens, documents and package flows were removed.');

        return Command::SUCCESS;
    }

    private function tableExists(string $table): bool
    {
        return $this->connection->createSchemaManager()->tablesExist([$table]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function demoAccounts(): array
    {
        return [
            [
                'email' => 'superadmin@docmanager.local',
                'password' => 'superadmin123',
                'roles' => ['ROLE_SUPER_ADMIN'],
                'accountCode' => 'DM-SUPER',
                'firstName' => 'Super',
                'lastName' => 'Administrator',
                'personType' => 'individual',
                'companyName' => null,
                'taxIdentifier' => null,
                'optionalFields' => [
                    'status' => 'activ',
                    'phone' => '+40 700 000 000',
                    'cnp' => '1800101000000',
                    'address' => [
                        'street' => 'Bulevardul Platformei',
                        'number' => '10',
                        'city' => 'Bucuresti',
                        'county' => 'Bucuresti',
                        'sector' => '1',
                        'postalCode' => '010101',
                    ],
                    'linkedInstitutionIds' => ['primaria-joita', 'primaria-pleasov'],
                    'onboardingStatus' => 'approved',
                ],
            ],
            [
                'email' => 'pf.demo@docmanager.local',
                'password' => 'demo12345',
                'roles' => ['ROLE_USER'],
                'accountCode' => 'DM-PF-001',
                'firstName' => 'Ion',
                'lastName' => 'Popescu',
                'personType' => 'individual',
                'companyName' => null,
                'taxIdentifier' => null,
                'optionalFields' => [
                    'status' => 'activ',
                    'phone' => '+40 700 000 010',
                    'cnp' => '1800101000100',
                    'identityDocument' => [
                        'series' => 'GG',
                        'number' => '123456',
                        'issuedBy' => 'SPCLEP Joita',
                        'validUntil' => '2030-12-31',
                    ],
                    'address' => [
                        'street' => 'Strada Principala',
                        'number' => '24',
                        'city' => 'Joita',
                        'county' => 'Giurgiu',
                        'postalCode' => '087150',
                    ],
                    'linkedInstitutionIds' => ['primaria-joita', 'primaria-pleasov'],
                    'onboardingStatus' => 'approved',
                ],
            ],
            [
                'email' => 'pj.demo@docmanager.local',
                'password' => 'demo12345',
                'roles' => ['ROLE_USER'],
                'accountCode' => 'DM-PJ-001',
                'firstName' => '',
                'lastName' => '',
                'personType' => 'company',
                'companyName' => 'Demo Construct SRL',
                'taxIdentifier' => '11223344',
                'optionalFields' => [
                    'status' => 'activ',
                    'phone' => '+40 700 000 020',
                    'company' => [
                        'cif' => '11223344',
                        'name' => 'Demo Construct SRL',
                        'registrationNumber' => 'J52/123/2020',
                        'address' => 'Strada Fabricii nr. 8, Joita, Giurgiu',
                        'source' => 'seed-account',
                    ],
                    'address' => [
                        'street' => 'Strada Fabricii',
                        'number' => '8',
                        'city' => 'Joita',
                        'county' => 'Giurgiu',
                        'postalCode' => '087150',
                    ],
                    'linkedInstitutionIds' => ['primaria-joita'],
                    'onboardingStatus' => 'approved',
                ],
            ],
            [
                'email' => 'primaria.joita@docmanager.local',
                'password' => 'demo12345',
                'roles' => ['ROLE_USER'],
                'accountCode' => 'DM-INS-01',
                'firstName' => '',
                'lastName' => '',
                'personType' => 'institution',
                'companyName' => 'Primaria Joita',
                'taxIdentifier' => '12345678',
                'optionalFields' => [
                    'status' => 'activ',
                    'phone' => '+40 246 000 100',
                    'company' => [
                        'cif' => '12345678',
                        'name' => 'Primaria Joita',
                        'registrationNumber' => '',
                        'address' => 'Strada Primariei nr. 1, Joita, Giurgiu',
                        'source' => 'seed-account',
                    ],
                    'address' => [
                        'street' => 'Strada Primariei',
                        'number' => '1',
                        'city' => 'Joita',
                        'county' => 'Giurgiu',
                        'postalCode' => '087150',
                    ],
                    'linkedInstitutionIds' => ['primaria-joita'],
                    'onboardingStatus' => 'approved',
                    'approvalDocuments' => ['cerere_inrolare.pdf', 'delegatie_reprezentant.pdf'],
                ],
            ],
            [
                'email' => 'primaria.pleasov@docmanager.local',
                'password' => 'demo12345',
                'roles' => ['ROLE_USER'],
                'accountCode' => 'DM-INS-02',
                'firstName' => '',
                'lastName' => '',
                'personType' => 'institution',
                'companyName' => 'Primaria Pleasov',
                'taxIdentifier' => '87654321',
                'optionalFields' => [
                    'status' => 'activ',
                    'phone' => '+40 246 000 200',
                    'company' => [
                        'cif' => '87654321',
                        'name' => 'Primaria Pleasov',
                        'registrationNumber' => '',
                        'address' => 'Strada Primariei nr. 2, Pleasov, Olt',
                        'source' => 'seed-account',
                    ],
                    'address' => [
                        'street' => 'Strada Primariei',
                        'number' => '2',
                        'city' => 'Pleasov',
                        'county' => 'Olt',
                        'postalCode' => '237000',
                    ],
                    'linkedInstitutionIds' => ['primaria-pleasov'],
                    'onboardingStatus' => 'approved',
                    'approvalDocuments' => ['cerere_inrolare.pdf', 'delegatie_reprezentant.pdf'],
                ],
            ],
        ];
    }
}
