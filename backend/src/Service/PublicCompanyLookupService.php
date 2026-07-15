<?php

namespace App\Service;

final class PublicCompanyLookupService
{
    private const DEMO_COMPANIES = [
        '11223344' => [
            'name' => 'Demo Construct SRL',
            'registrationNumber' => 'J23/1456/2020',
            'address' => 'Comuna Joita, Strada Principala nr. 12',
            'status' => 'date demo pentru dezvoltare',
        ],
        '12345678' => [
            'name' => 'Primaria Joita',
            'registrationNumber' => '',
            'address' => 'Comuna Joita, Judetul Giurgiu',
            'status' => 'date demo pentru dezvoltare',
        ],
        '87654321' => [
            'name' => 'Primaria Pleasov',
            'registrationNumber' => '',
            'address' => 'Comuna Pleasov, Judetul Olt',
            'status' => 'date demo pentru dezvoltare',
        ],
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

    /**
     * @return array<string, mixed>
     */
    public function lookup(string $cif): array
    {
        $normalizedCif = $this->normalizeCif($cif);

        if ($normalizedCif === '') {
            return [
                'cif' => '',
                'message' => 'CIF-ul nu este valid.',
                'lookupStatus' => 'invalid',
                'manualEntryAllowed' => false,
            ];
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

        return [
            'cif' => $normalizedCif,
            'name' => (string) ($found['denumire'] ?? $found['name'] ?? ''),
            'registrationNumber' => (string) ($found['nrRegCom'] ?? $found['nr_reg_com'] ?? ''),
            'address' => (string) ($found['adresa'] ?? $found['address'] ?? ''),
            'postalCode' => (string) ($found['codPostal'] ?? $found['cod_postal'] ?? ''),
            'phone' => (string) ($found['telefon'] ?? $found['phone'] ?? ''),
            'status' => (string) ($found['stare_inregistrare'] ?? $found['status'] ?? ''),
            'source' => 'ANAF',
            'lookupStatus' => 'found',
            'manualEntryAllowed' => true,
        ];
    }

    public function normalizeCif(string $cif): string
    {
        return preg_replace('/\D+/', '', $cif) ?? '';
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
        $found = $data['found'] ?? null;
        $firstFound = is_array($found) ? ($found[0] ?? null) : null;
        $candidates = [
            is_array($firstFound) ? ($firstFound['date_generale'] ?? null) : null,
            is_array($firstFound) ? ($firstFound['dateGenerale'] ?? null) : null,
            $firstFound,
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

    /**
     * @return array<string, mixed>
     */
    private function fallbackOrManual(string $normalizedCif, string $message): array
    {
        if (isset(self::DEMO_COMPANIES[$normalizedCif])) {
            return [
                'cif' => $normalizedCif,
                ...self::DEMO_COMPANIES[$normalizedCif],
                'source' => 'date demo',
                'lookupStatus' => 'demo_fallback',
                'manualEntryAllowed' => true,
                'warning' => 'ANAF nu a fost disponibil pentru aceasta cautare. Am incarcat date demo locale.',
            ];
        }

        return [
            'cif' => $normalizedCif,
            'message' => $message,
            'manualEntryAllowed' => true,
            'lookupStatus' => 'manual_required',
            'source' => 'manual',
        ];
    }
}
