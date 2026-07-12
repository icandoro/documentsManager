<?php

namespace App\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class PublicCompanyController
{
    private const DEMO_COMPANIES = [
        '14399840' => [
            'name' => 'DANTE INTERNATIONAL SA',
            'registrationNumber' => 'J40/372/2002',
            'address' => 'Municipiul Bucuresti, Sector 6',
            'status' => 'date demo pentru dezvoltare',
        ],
        '15538360' => [
            'name' => 'ORANGE ROMANIA SA',
            'registrationNumber' => 'J40/10178/1996',
            'address' => 'Municipiul Bucuresti',
            'status' => 'date demo pentru dezvoltare',
        ],
    ];

    #[Route('/api/public/company/{cif}', name: 'api_public_company_options', methods: ['OPTIONS'])]
    public function companyOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/public/company/{cif}', name: 'api_public_company_lookup', methods: ['GET'])]
    public function lookup(string $cif): JsonResponse
    {
        $normalizedCif = preg_replace('/\D+/', '', $cif) ?? '';

        if ($normalizedCif === '') {
            return $this->cors(new JsonResponse(['message' => 'CIF-ul nu este valid.'], 422));
        }

        $payload = json_encode([
            ['cui' => (int) $normalizedCif, 'data' => (new \DateTimeImmutable())->format('Y-m-d')],
        ], JSON_THROW_ON_ERROR);

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\nAccept: application/json\r\n",
                'content' => $payload,
                'ignore_errors' => true,
                'timeout' => 8,
            ],
        ]);

        $endpoint = $_ENV['ANAF_COMPANY_LOOKUP_URL'] ?? 'https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva';
        $rawResponse = @file_get_contents($endpoint, false, $context);

        if ($rawResponse !== false && !str_starts_with(ltrim($rawResponse), '{')) {
            $rawResponse = false;
        }

        if ($rawResponse === false) {
            return $this->fallbackOrManual($normalizedCif, 'Nu am putut prelua automat datele publice acum. Completeaza manual campurile si poti continua.');
        }

        $data = json_decode($rawResponse, true);
        $found = is_array($data) ? $this->extractCompanyData($data) : null;

        if (!is_array($found)) {
            return $this->fallbackOrManual($normalizedCif, 'Nu am gasit date publice pentru acest CIF. Completeaza manual campurile si poti continua.');
        }

        return $this->cors(new JsonResponse([
            'cif' => $normalizedCif,
            'name' => $found['denumire'] ?? '',
            'registrationNumber' => $found['nrRegCom'] ?? '',
            'address' => $found['adresa'] ?? '',
            'postalCode' => $found['codPostal'] ?? '',
            'phone' => $found['telefon'] ?? '',
            'status' => $found['stare_inregistrare'] ?? '',
            'source' => 'ANAF',
        ]));
    }

    /**
     * ANAF has changed this payload shape across versions, so keep extraction tolerant.
     *
     * @param array<string, mixed> $data
     *
     * @return array<string, mixed>|null
     */
    private function extractCompanyData(array $data): ?array
    {
        $candidates = [
            $data['found'][0]['date_generale'] ?? null,
            $data['found'][0]['dateGenerale'] ?? null,
            $data['found'][0] ?? null,
            $data['date_generale'] ?? null,
            $data['dateGenerale'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_array($candidate) && (($candidate['denumire'] ?? '') !== '' || ($candidate['name'] ?? '') !== '')) {
                return $candidate;
            }
        }

        return null;
    }

    private function fallbackOrManual(string $normalizedCif, string $message): JsonResponse
    {
        if (isset(self::DEMO_COMPANIES[$normalizedCif])) {
            return $this->cors(new JsonResponse([
                'cif' => $normalizedCif,
                ...self::DEMO_COMPANIES[$normalizedCif],
                'source' => 'date demo',
                'lookupStatus' => 'demo_fallback',
                'warning' => 'ANAF nu a fost disponibil pentru aceasta cautare. Am incarcat date demo locale.',
            ]));
        }

        return $this->cors(new JsonResponse([
            'cif' => $normalizedCif,
            'message' => $message,
            'manualEntryAllowed' => true,
            'lookupStatus' => 'manual_required',
            'source' => 'manual',
        ]));
    }

    private function cors(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Access-Control-Allow-Origin', 'http://localhost:13000');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        return $response;
    }
}
