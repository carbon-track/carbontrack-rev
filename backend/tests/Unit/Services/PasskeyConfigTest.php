<?php

declare(strict_types=1);

namespace CarbonRack\Tests\Unit\Services;

use CarbonRack\Services\PasskeyConfig;
use PHPUnit\Framework\TestCase;

class PasskeyConfigTest extends TestCase
{
    public function testGetRpIdKeepsConfiguredSuffixWhenCompatibleWithFrontendHost(): void
    {
        $config = new PasskeyConfig([
            'PASSKEYS_RP_ID' => 'carbonrackapp.com',
            'FRONTEND_URL' => 'https://dev.carbonrackapp.com',
        ]);

        $this->assertSame('carbonrackapp.com', $config->getRpId());
    }

    public function testGetRpIdFallsBackToFrontendHostWhenConfiguredRpIdMismatchesFrontendHost(): void
    {
        $config = new PasskeyConfig([
            'PASSKEYS_RP_ID' => 'carbonrack.com',
            'PASSKEYS_ORIGINS' => 'https://dev.carbonrack.com',
            'FRONTEND_URL' => 'https://dev.carbonrackapp.com',
        ]);

        $this->assertSame('dev.carbonrackapp.com', $config->getRpId());
    }

    public function testGetAllowedOriginsIncludesFrontendOriginWhenExplicitOriginsMissIt(): void
    {
        $config = new PasskeyConfig([
            'PASSKEYS_ORIGINS' => 'https://dev.carbonrack.com/',
            'FRONTEND_URL' => 'https://dev.carbonrackapp.com/',
        ]);

        $this->assertSame([
            'https://dev.carbonrack.com',
            'https://dev.carbonrackapp.com',
        ], $config->getAllowedOrigins());
    }

    public function testGetAllowedOriginsFallsBackToFrontendOriginBeforeAppUrl(): void
    {
        $config = new PasskeyConfig([
            'FRONTEND_URL' => 'https://dev.carbonrackapp.com/path',
            'APP_URL' => 'https://dev-api.carbonrackapp.com',
        ]);

        $this->assertSame([
            'https://dev.carbonrackapp.com',
        ], $config->getAllowedOrigins());
    }

    public function testGetAllowedOriginsFallsBackToAppUrlWhenFrontendUrlMissing(): void
    {
        $config = new PasskeyConfig([
            'APP_URL' => 'https://dev-api.carbonrackapp.com/api',
        ]);

        $this->assertSame([
            'https://dev-api.carbonrackapp.com',
        ], $config->getAllowedOrigins());
    }
}
