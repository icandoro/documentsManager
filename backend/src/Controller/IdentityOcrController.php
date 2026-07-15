<?php

namespace App\Controller;

use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class IdentityOcrController
{
    #[Route('/api/ocr/identity', name: 'api_ocr_identity_options', methods: ['OPTIONS'])]
    public function options(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/ocr/identity', name: 'api_ocr_identity', methods: ['POST'])]
    public function readIdentity(Request $request): JsonResponse
    {
        $file = $request->files->get('identity');

        if (!$file instanceof UploadedFile) {
            return $this->cors(new JsonResponse(['message' => 'Incarca o poza cu buletinul.'], 422));
        }

        if ($file->getSize() !== null && $file->getSize() > 8 * 1024 * 1024) {
            return $this->cors(new JsonResponse(['message' => 'Imaginea este prea mare. Limita este 8 MB.'], 413));
        }

        $mimeType = strtolower((string) $file->getClientMimeType());
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp', 'image/heic', 'image/heif'];
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp', 'heic', 'heif'];
        if (!in_array($mimeType, $allowedMimeTypes, true) && !in_array($extension, $allowedExtensions, true)) {
            return $this->cors(new JsonResponse(['message' => 'Format imagine neacceptat pentru OCR.'], 422));
        }

        [$exitCode, $text, $error, $strategy] = $this->runIdentityOcr($file->getPathname());

        if ($exitCode !== 0) {
            return $this->cors(new JsonResponse([
                'message' => 'OCR-ul local nu a putut citi imaginea. Incearca o poza frontala, clara, cu tot buletinul in cadru si fara reflexii.',
                'details' => trim($error) ?: null,
            ], 422));
        }

        $fields = $this->parseRomanianIdentity($text);

        return $this->cors(new JsonResponse([
            'message' => $this->hasAnyField($fields)
                ? 'Datele au fost citite local din imagine. Verifica-le inainte de salvare.'
                : 'OCR-ul local a citit textul, dar nu a identificat automat campurile principale.',
            'source' => 'local-tesseract',
            'strategy' => $strategy,
            'fields' => $fields,
            'rawText' => trim($text),
        ]));
    }

    /**
     * @return array{0:int, 1:string, 2:string, 3:string}
     */
    private function runIdentityOcr(string $path): array
    {
        $variants = $this->createImageVariants($path);
        $best = [1, '', 'Nu s-a putut porni OCR-ul local.', 'none'];

        foreach ($variants as $variantName => $variantPath) {
            foreach ([6, 11, 4] as $pageSegmentationMode) {
                [$exitCode, $text, $error] = $this->runTesseract($variantPath, $pageSegmentationMode);
                $candidate = [$exitCode, $text, $error, $variantName.'-psm'.$pageSegmentationMode];

                if ($best[3] === 'none') {
                    $best = $candidate;
                }

                $candidateScore = $this->scoreOcrText($text);
                if ($exitCode === 0 && $candidateScore > $this->scoreOcrText($best[1])) {
                    $best = $candidate;

                    if ($candidateScore >= 1800) {
                        break 2;
                    }
                }
            }
        }

        $this->removeTemporaryVariants($path, $variants);

        if ($best[0] === 0 && trim($best[1]) !== '') {
            return $best;
        }

        return $best[0] === 0 ? [1, $best[1], 'OCR-ul nu a returnat text util.', $best[3]] : [1, $best[1], $best[2], $best[3]];
    }

    /**
     * @return array{0:int, 1:string, 2:string}
     */
    private function runTesseract(string $path, int $pageSegmentationMode): array
    {
        $descriptorSpec = [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = proc_open(
            ['tesseract', $path, 'stdout', '-l', 'ron+eng', '--oem', '1', '--psm', (string) $pageSegmentationMode],
            $descriptorSpec,
            $pipes
        );

        if (!is_resource($process)) {
            return [1, '', 'Procesul OCR nu a putut fi pornit.'];
        }

        $output = stream_get_contents($pipes[1]) ?: '';
        $error = stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);

        return [$exitCode, $output, $error];
    }

    /**
     * @return array<string, string>
     */
    private function createImageVariants(string $path): array
    {
        $variants = ['original' => $path];
        $magick = $this->findCommand(['magick', 'convert']);

        if ($magick === null) {
            return $variants;
        }

        $base = tempnam(sys_get_temp_dir(), 'identity_ocr_');
        if ($base === false) {
            return $variants;
        }
        @unlink($base);

        $gray = $base.'_gray.png';
        $threshold = $base.'_threshold.png';

        $this->runProcess([
            $magick,
            $path,
            '-auto-orient',
            '-resize',
            '2600x2600>',
            '-colorspace',
            'Gray',
            '-normalize',
            '-contrast-stretch',
            '1%x1%',
            '-sharpen',
            '0x1',
            $gray,
        ]);

        if (is_file($gray) && filesize($gray) > 0) {
            $variants['gray'] = $gray;
        }

        $this->runProcess([
            $magick,
            $path,
            '-auto-orient',
            '-resize',
            '3200x3200>',
            '-colorspace',
            'Gray',
            '-normalize',
            '-adaptive-threshold',
            '35x35+10%',
            '-sharpen',
            '0x1',
            $threshold,
        ]);

        if (is_file($threshold) && filesize($threshold) > 0) {
            $variants['threshold'] = $threshold;
        }

        return $variants;
    }

    /**
     * @param array<string, string> $variants
     */
    private function removeTemporaryVariants(string $originalPath, array $variants): void
    {
        foreach ($variants as $variantPath) {
            if ($variantPath !== $originalPath && is_file($variantPath)) {
                @unlink($variantPath);
            }
        }
    }

    /**
     * @param array<int, string> $candidates
     */
    private function findCommand(array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            [$exitCode, $output] = $this->runProcess(['which', $candidate]);

            if ($exitCode === 0 && trim($output) !== '') {
                return trim($output);
            }
        }

        return null;
    }

    /**
     * @param array<int, string> $command
     * @return array{0:int, 1:string, 2:string}
     */
    private function runProcess(array $command): array
    {
        $descriptorSpec = [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = proc_open($command, $descriptorSpec, $pipes);

        if (!is_resource($process)) {
            return [1, '', 'Procesul nu a putut fi pornit.'];
        }

        $output = stream_get_contents($pipes[1]) ?: '';
        $error = stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[1]);
        fclose($pipes[2]);

        return [proc_close($process), $output, $error];
    }

    private function scoreOcrText(string $text): int
    {
        $normalized = $this->normalize($text);
        $score = min(strlen(trim($normalized)), 500);

        foreach (['CARTE DE IDENTITATE', 'ROMANIA', 'NUME', 'PRENUME', 'CNP', 'DOMICILIU', 'VALABILITATE'] as $label) {
            if (str_contains($normalized, $label)) {
                $score += 250;
            }
        }

        if (preg_match('/\b[1-9]\d{12}\b/', $normalized)) {
            $score += 1000;
        }

        if (preg_match('/\b[A-Z]{2}\s*\d{6}\b/', $normalized)) {
            $score += 400;
        }

        return $score;
    }

    /**
     * @return array<string, string>
     */
    private function parseRomanianIdentity(string $text): array
    {
        $normalized = $this->normalize($text);
        $lines = array_values(array_filter(array_map(
            static fn (string $line): string => trim(preg_replace('/\s+/', ' ', $line) ?? ''),
            preg_split('/\R/', $normalized) ?: []
        )));
        $flat = implode(' ', $lines);

        $compactFlat = preg_replace('/\s+/', ' ', $flat) ?? $flat;
        preg_match('/\b(?:CNP\s*)?([1-9](?:\s*\d){12})\b/', $compactFlat, $cnpMatch);
        preg_match('/\b(?:SERIA|SERIE)?\s*([A-Z]{2})\s*(?:NR\.?|NUMAR)?\s*(\d{6})\b/', $compactFlat, $seriesMatch);
        preg_match_all('/\b(\d{2}[.\/-]\d{2}[.\/-]\d{4}|\d{4}[.\/-]\d{2}[.\/-]\d{2})\b/', $flat, $dateMatches);

        $name = $this->extractValue($lines, ['NUME', 'LAST NAME', 'NOM']);
        $firstName = $this->extractValue($lines, ['PRENUME', 'FIRST NAME', 'PRENOMS']);
        $address = $this->extractValue($lines, ['DOMICILIU', 'ADRESA', 'ADDRESS']);
        $issuedBy = $this->extractValue($lines, ['ELIBERAT', 'EMIS', 'ISSUED BY']);
        $validUntil = $dateMatches[1] !== [] ? (string) end($dateMatches[1]) : '';

        return [
            'lastName' => $this->cleanPersonName($name),
            'firstName' => $this->cleanPersonName($firstName),
            'cnp' => isset($cnpMatch[1]) ? preg_replace('/\D+/', '', $cnpMatch[1]) ?? '' : '',
            'series' => $seriesMatch[1] ?? '',
            'number' => $seriesMatch[2] ?? '',
            'address' => $this->cleanValue($address),
            'county' => $this->extractCounty($flat),
            'city' => $this->extractCity($address),
            'issuedBy' => $this->cleanValue($issuedBy),
            'validUntil' => $this->normalizeDate($validUntil),
        ];
    }

    /**
     * @param array<int, string> $lines
     * @param array<int, string> $labels
     */
    private function extractValue(array $lines, array $labels): string
    {
        foreach ($lines as $index => $line) {
            foreach ($labels as $label) {
                if (!str_contains($line, $label)) {
                    continue;
                }

                $parts = preg_split('/'.preg_quote($label, '/').'[:\s-]*/', $line, 2);
                $value = isset($parts[1]) ? trim($parts[1]) : '';

                if ($value !== '' && strlen($value) > 2) {
                    return $value;
                }

                return $lines[$index + 1] ?? '';
            }
        }

        return '';
    }

    private function extractCounty(string $text): string
    {
        if (preg_match('/\bJUD(?:ET)?\.?\s*([A-Z][A-Z\s-]{2,24})\b/', $text, $match)) {
            return $this->cleanValue($match[1]);
        }

        return '';
    }

    private function extractCity(string $address): string
    {
        if (preg_match('/\b(?:MUN|ORAS|COM|SAT)\.?\s*([A-Z][A-Z\s-]{2,32})\b/', $address, $match)) {
            return $this->cleanValue($match[1]);
        }

        return '';
    }

    private function normalizeDate(string $date): string
    {
        if ($date === '') {
            return '';
        }

        $date = str_replace(['.', '/'], '-', $date);
        if (preg_match('/^(\d{2})-(\d{2})-(\d{4})$/', $date, $match)) {
            return sprintf('%s-%s-%s', $match[3], $match[2], $match[1]);
        }

        return $date;
    }

    private function normalize(string $text): string
    {
        $map = [
            'ă' => 'A', 'â' => 'A', 'î' => 'I', 'ș' => 'S', 'ş' => 'S', 'ț' => 'T', 'ţ' => 'T',
            'Ă' => 'A', 'Â' => 'A', 'Î' => 'I', 'Ș' => 'S', 'Ş' => 'S', 'Ț' => 'T', 'Ţ' => 'T',
        ];

        return strtoupper(strtr($text, $map));
    }

    private function cleanPersonName(string $value): string
    {
        $value = preg_replace('/[^A-Z\s-]/', ' ', $value) ?? '';

        return $this->cleanValue($value);
    }

    private function cleanValue(string $value): string
    {
        return trim(preg_replace('/\s+/', ' ', $value) ?? '');
    }

    /**
     * @param array<string, string> $fields
     */
    private function hasAnyField(array $fields): bool
    {
        foreach ($fields as $value) {
            if ($value !== '') {
                return true;
            }
        }

        return false;
    }

    private function cors(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Access-Control-Allow-Origin', 'http://localhost:13000');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        return $response;
    }
}
