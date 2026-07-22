<?php

namespace App\Command;

use App\Entity\Institution;
use App\Entity\InstitutionTaxpayer;
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
        foreach (['document_package_items', 'document_packages', 'documents', 'institution_taxpayers', 'profiles', 'users', 'institutions'] as $table) {
            if ($this->tableExists($table)) {
                $this->connection->executeStatement(sprintf('TRUNCATE TABLE %s', $table));
            }
        }
        $this->connection->executeStatement('SET FOREIGN_KEY_CHECKS=1');

        $institution = (new Institution())
            ->setName('Primaria Joita')
            ->setCif('12345678')
            ->setLocality('Joita')
            ->setCounty('Giurgiu')
            ->setAddress('Strada Primariei nr. 1, Joita, Giurgiu')
            ->setPhone('+40 246 000 100')
            ->setContactEmail('primaria.joita@docmanager.local')
            ->setStatus('activ')
            ->setOnboardingStatus('approved')
            ->setOnboardingDocuments(['approvalDocuments' => ['cerere_inrolare.pdf', 'delegatie_reprezentant.pdf']]);
        $this->entityManager->persist($institution);
        $this->entityManager->flush();

        $users = [];

        foreach ($this->demoAccounts() as $key => $account) {
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

            if ($account['personType'] === 'institution') {
                $profile->setInstitutionId($institution->getId());
            }

            $user->setProfile($profile);
            $this->entityManager->persist($user);
            $this->entityManager->persist($profile);
            $users[$key] = $user;
        }

        $this->entityManager->flush();

        // Now that every demo account has a real id, link the citizens to the
        // institution for real: set linkedInstitutionIds on their profiles and
        // create the matching institution_taxpayers roster rows, so the
        // institution actually sees them in its own citizen list.
        $institutionId = (int) $institution->getId();

        foreach (['superadmin', 'individual', 'company'] as $key) {
            $profile = $users[$key]->getProfile();
            $optionalFields = $profile->getOptionalFields();
            $optionalFields['linkedInstitutionIds'] = [(string) $institutionId];
            $profile->setOptionalFields($optionalFields);
        }

        $individualProfile = $users['individual']->getProfile();
        $taxpayerPerson = (new InstitutionTaxpayer())
            ->setInstitutionId($institutionId)
            ->setType('person')
            ->setName(trim($individualProfile->getLastName().' '.$individualProfile->getFirstName()))
            ->setIdentifier((string) $individualProfile->getOptionalFields()['cnp'])
            ->setLocality((string) $individualProfile->getOptionalFields()['address']['city'])
            ->setEmail($users['individual']->getEmail())
            ->setPhone((string) $individualProfile->getOptionalFields()['phone'])
            ->setAccountKind('resident')
            ->setLinkedUserId($users['individual']->getId())
            ->setStatus('legat')
            ->setDetails([]);
        $this->entityManager->persist($taxpayerPerson);

        $companyProfile = $users['company']->getProfile();
        $taxpayerCompany = (new InstitutionTaxpayer())
            ->setInstitutionId($institutionId)
            ->setType('company')
            ->setName((string) $companyProfile->getCompanyName())
            ->setIdentifier((string) $companyProfile->getTaxIdentifier())
            ->setLocality((string) $companyProfile->getOptionalFields()['address']['city'])
            ->setEmail($users['company']->getEmail())
            ->setPhone((string) $companyProfile->getOptionalFields()['phone'])
            ->setAccountKind('company_hq')
            ->setLinkedUserId($users['company']->getId())
            ->setStatus('legat')
            ->setDetails([]);
        $this->entityManager->persist($taxpayerCompany);

        $this->entityManager->flush();

        $io->success('Demo database was reset. Created the 4 login demo accounts (superadmin, persoana fizica, persoana juridica, institutie), linked and enrolled in the institution roster. Documents and package flows were removed.');

        return Command::SUCCESS;
    }

    private function tableExists(string $table): bool
    {
        return $this->connection->createSchemaManager()->tablesExist([$table]);
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function demoAccounts(): array
    {
        return [
            'superadmin' => [
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
                    'linkedInstitutionIds' => [],
                    'onboardingStatus' => 'approved',
                ],
            ],
            'individual' => [
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
                    'linkedInstitutionIds' => [],
                    'onboardingStatus' => 'approved',
                ],
            ],
            'company' => [
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
                    'linkedInstitutionIds' => [],
                    'onboardingStatus' => 'approved',
                ],
            ],
            'institution' => [
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
                    'linkedInstitutionIds' => [],
                    'onboardingStatus' => 'approved',
                ],
            ],
        ];
    }
}
