<?php

namespace App\Controller;

use App\Service\PublicCompanyLookupService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class PublicCompanyController
{
    #[Route('/api/public/company/{cif}', name: 'api_public_company_options', methods: ['OPTIONS'])]
    public function companyOptions(): JsonResponse
    {
        return $this->cors(new JsonResponse(null, 204));
    }

    #[Route('/api/public/company/{cif}', name: 'api_public_company_lookup', methods: ['GET'])]
    public function lookup(string $cif, PublicCompanyLookupService $companyLookup): JsonResponse
    {
        $result = $companyLookup->lookup($cif);

        if (($result['lookupStatus'] ?? null) === 'invalid') {
            return $this->cors(new JsonResponse(['message' => 'CIF-ul nu este valid.'], 422));
        }

        return $this->cors(new JsonResponse($result));
    }

    private function cors(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Access-Control-Allow-Origin', 'http://localhost:13000');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        return $response;
    }
}
