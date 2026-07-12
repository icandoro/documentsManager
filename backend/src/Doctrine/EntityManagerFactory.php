<?php

namespace App\Doctrine;

use Doctrine\DBAL\DriverManager;
use Doctrine\ORM\EntityManager;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\ORMSetup;

final class EntityManagerFactory
{
    public static function create(string $databaseUrl, string $projectDir, string $environment): EntityManagerInterface
    {
        $connectionParams = self::parseDatabaseUrl($databaseUrl);
        $config = ORMSetup::createAttributeMetadataConfiguration(
            paths: [$projectDir.'/src/Entity'],
            isDevMode: $environment !== 'prod',
        );
        $config->enableNativeLazyObjects(true);

        $connection = DriverManager::getConnection($connectionParams, $config);

        return new EntityManager($connection, $config);
    }

    /**
     * @return array<string, mixed>
     */
    private static function parseDatabaseUrl(string $databaseUrl): array
    {
        $parts = parse_url($databaseUrl);

        if ($parts === false || !isset($parts['host'], $parts['path'], $parts['user'])) {
            throw new \InvalidArgumentException('Invalid DATABASE_URL.');
        }

        $query = [];
        parse_str($parts['query'] ?? '', $query);

        return [
            'driver' => 'pdo_mysql',
            'host' => $parts['host'],
            'port' => isset($parts['port']) ? (int) $parts['port'] : 3306,
            'dbname' => ltrim($parts['path'], '/'),
            'user' => rawurldecode($parts['user']),
            'password' => rawurldecode($parts['pass'] ?? ''),
            'charset' => $query['charset'] ?? 'utf8mb4',
        ];
    }
}
