<?php

declare(strict_types=1);

namespace CarbonRack\Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use CarbonRack\Services\CloudflareR2Service;

class CloudflareR2ServiceTest extends TestCase
{
    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(CloudflareR2Service::class));
    }
}


