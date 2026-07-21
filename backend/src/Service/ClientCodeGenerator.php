<?php

namespace App\Service;

final class ClientCodeGenerator
{
    /**
     * Deterministic, unique-per-account numeric code derived from the account's
     * (already-unique) accountCode, so it stays stable across logins and is
     * searchable/identifiable by platform staff.
     */
    public function fromAccountCode(string $accountCode): string
    {
        $hash = 0;

        for ($index = 0; $index < strlen($accountCode); $index++) {
            $hash = ($hash * 31 + ord($accountCode[$index])) & 0xFFFFFFFF;
        }

        return str_pad((string) $hash, 11, '0', STR_PAD_LEFT);
    }
}
