<?php

namespace App\Service;

final class InstitutionSlugGenerator
{
    public function fromNameAndCif(string $name, string $cif = ''): string
    {
        $value = strtolower(trim($name));
        $value = strtr($value, [
            'ă' => 'a', 'â' => 'a', 'î' => 'i', 'ș' => 's', 'ş' => 's', 'ț' => 't', 'ţ' => 't',
            'Ă' => 'a', 'Â' => 'a', 'Î' => 'i', 'Ș' => 's', 'Ş' => 's', 'Ț' => 't', 'Ţ' => 't',
        ]);
        $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
        $value = trim($value, '-');

        if ($value === '') {
            $value = 'institutie-'.preg_replace('/\D+/', '', $cif);
        }

        return $value;
    }
}
