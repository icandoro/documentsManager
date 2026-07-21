<?php

namespace App\Service;

final class PublicCompanyLookupService
{
    private const DEFAULT_ENDPOINTS = [
        'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
        'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v8/tva',
        'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v7/tva',
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

        $response = $this->requestAnaf($normalizedCif);

        if ($response['raw'] === null) {
            return $this->fallbackOrManual(
                $normalizedCif,
                'Serviciul ANAF nu a raspuns. Completeaza manual campurile si poti continua.',
                $response['debug'],
            );
        }

        $data = json_decode($response['raw'], true);
        $found = is_array($data) ? $this->extractCompanyData($data) : null;

        if (!is_array($found)) {
            return $this->fallbackOrManual(
                $normalizedCif,
                'Nu am gasit date publice pentru acest CIF. Completeaza manual campurile si poti continua.',
                $response['debug'],
            );
        }

        return [
            'cif' => $normalizedCif,
            'name' => (string) ($found['denumire'] ?? $found['name'] ?? ''),
            'registrationNumber' => (string) ($found['nrRegCom'] ?? $found['nr_reg_com'] ?? ''),
            'address' => (string) ($found['adresa'] ?? $found['address'] ?? ''),
            'postalCode' => (string) ($found['codPostal'] ?? $found['cod_postal'] ?? ''),
            'phone' => (string) ($found['telefon'] ?? $found['phone'] ?? ''),
            'status' => (string) ($found['stare_inregistrare'] ?? $found['status'] ?? ''),
            'fiscalAuthority' => (string) ($found['organFiscalCompetent'] ?? ''),
            'legalForm' => (string) ($found['forma_juridica'] ?? ''),
            'caen' => (string) ($found['cod_CAEN'] ?? ''),
            'eFacturaStatus' => (bool) ($found['statusRO_e_Factura'] ?? false),
            'source' => 'ANAF',
            'lookupStatus' => 'found',
            'manualEntryAllowed' => true,
            'lookupEndpoint' => $response['endpoint'],
        ];
    }

    public function normalizeCif(string $cif): string
    {
        return preg_replace('/\D+/', '', $cif) ?? '';
    }

    /**
     * @return array{raw: string|null, endpoint: string|null, debug: array<int, array<string, mixed>>}
     */
    private function requestAnaf(string $normalizedCif): array
    {
        $debug = [];

        foreach ($this->lookupDates() as $lookupDate) {
            $payload = json_encode([
                ['cui' => (int) $normalizedCif, 'data' => $lookupDate],
            ], JSON_THROW_ON_ERROR);

            foreach ($this->endpoints() as $endpoint) {
                $attempt = $this->requestEndpoint($endpoint, $payload);
                $debug[] = [
                    'endpoint' => $endpoint,
                    'date' => $lookupDate,
                    'httpCode' => $attempt['httpCode'],
                    'error' => $attempt['error'],
                ];

                if ($attempt['raw'] !== null) {
                    return [
                        'raw' => $attempt['raw'],
                        'endpoint' => $endpoint,
                        'debug' => $debug,
                    ];
                }
            }
        }

        return ['raw' => null, 'endpoint' => null, 'debug' => $debug];
    }

    /**
     * @return string[]
     */
    private function lookupDates(): array
    {
        $today = new \DateTimeImmutable('today');

        return array_values(array_unique([
            $today->format('Y-m-d'),
            $today->modify('-1 day')->format('Y-m-d'),
            $today->modify('-7 days')->format('Y-m-d'),
        ]));
    }

    /**
     * @return string[]
     */
    private function endpoints(): array
    {
        $configured = trim((string) ($_ENV['ANAF_COMPANY_LOOKUP_URL'] ?? ''));

        if ($configured !== '') {
            return array_values(array_unique([$configured, ...self::DEFAULT_ENDPOINTS]));
        }

        return self::DEFAULT_ENDPOINTS;
    }

    /**
     * @return array{raw: string|null, httpCode: int, error: string}
     */
    private function requestEndpoint(string $endpoint, string $payload): array
    {
        if (function_exists('curl_init')) {
            return $this->requestEndpointWithCurl($endpoint, $payload);
        }

        return $this->requestEndpointWithStream($endpoint, $payload);
    }

    /**
     * @return array{raw: string|null, httpCode: int, error: string}
     */
    private function requestEndpointWithCurl(string $endpoint, string $payload): array
    {
        $ch = curl_init($endpoint);

        if ($ch === false) {
            return ['raw' => null, 'httpCode' => 0, 'error' => 'curl_init_failed'];
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'Accept-Charset: utf-8',
                'User-Agent: DocManager/1.0',
            ],
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_CONNECTTIMEOUT => 6,
        ]);

        $raw = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if (!is_string($raw) || $httpCode < 200 || $httpCode >= 300 || !preg_match('/^[{\[]/', ltrim($raw))) {
            return ['raw' => null, 'httpCode' => $httpCode, 'error' => $error ?: 'invalid_response'];
        }

        return ['raw' => $raw, 'httpCode' => $httpCode, 'error' => ''];
    }

    /**
     * @return array{raw: string|null, httpCode: int, error: string}
     */
    private function requestEndpointWithStream(string $endpoint, string $payload): array
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\nAccept: application/json\r\nAccept-Charset: utf-8\r\nUser-Agent: DocManager/1.0\r\n",
                'content' => $payload,
                'ignore_errors' => true,
                'timeout' => 12,
            ],
        ]);
        $raw = @file_get_contents($endpoint, false, $context);
        $httpCode = 0;

        foreach ($http_response_header ?? [] as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $matches)) {
                $httpCode = (int) $matches[1];
                break;
            }
        }

        if (!is_string($raw) || $httpCode < 200 || $httpCode >= 300 || !preg_match('/^[{\[]/', ltrim($raw))) {
            return ['raw' => null, 'httpCode' => $httpCode, 'error' => 'invalid_response'];
        }

        return ['raw' => $raw, 'httpCode' => $httpCode, 'error' => ''];
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
        $firstRoot = array_is_list($data) ? ($data[0] ?? null) : null;
        $candidates = [
            is_array($firstFound) ? ($firstFound['date_generale'] ?? null) : null,
            is_array($firstFound) ? ($firstFound['dateGenerale'] ?? null) : null,
            $firstFound,
            is_array($firstRoot) ? ($firstRoot['date_generale'] ?? null) : null,
            is_array($firstRoot) ? ($firstRoot['dateGenerale'] ?? null) : null,
            $firstRoot,
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
    private function fallbackOrManual(string $normalizedCif, string $message, array $debug = []): array
    {
        return [
            'cif' => $normalizedCif,
            'message' => $message,
            'manualEntryAllowed' => true,
            'lookupStatus' => 'manual_required',
            'source' => 'manual',
            'lookupDebug' => $debug,
        ];
    }
}
