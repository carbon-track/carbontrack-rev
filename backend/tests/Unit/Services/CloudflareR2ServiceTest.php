<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use Aws\MockHandler;
use Aws\Result;
use Aws\S3\S3Client;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\AuditLogService;
use Monolog\Handler\NullHandler;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;

class CloudflareR2ServiceTest extends TestCase
{
    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(CloudflareR2Service::class));
    }

    public function testValidateDirectUploadObjectAcceptsMatchingPngContent(): void
    {
        $service = $this->makeServiceWithGetObjectBody("\x89PNG\x0D\x0A\x1A\x0A" . str_repeat("\0", 24));

        $service->validateDirectUploadObject('uploads/ok.png', 'ok.png', [
            'size' => 32,
            'mime_type' => 'image/png',
        ]);

        $this->addToAssertionCount(1);
    }

    public function testValidateDirectUploadObjectRejectsDisguisedContent(): void
    {
        $service = $this->makeServiceWithGetObjectBody('MZ' . str_repeat("\0", 32));

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('File content does not match the declared MIME type');

        $service->validateDirectUploadObject('uploads/bad.png', 'bad.png', [
            'size' => 34,
            'mime_type' => 'image/png',
        ]);
    }

    private function makeServiceWithGetObjectBody(string $body): CloudflareR2Service
    {
        $logger = new Logger('test');
        $logger->pushHandler(new NullHandler());
        $auditLog = $this->createMock(AuditLogService::class);
        $service = new CloudflareR2Service(
            'test-access',
            'test-secret',
            'https://example.r2.cloudflarestorage.com',
            'media',
            'https://pub-example.r2.dev/media',
            $logger,
            $auditLog
        );

        $mock = new MockHandler();
        $mock->append(new Result(['Body' => $body]));
        $s3Client = new S3Client([
            'version' => 'latest',
            'region' => 'auto',
            'endpoint' => 'https://example.r2.cloudflarestorage.com',
            'credentials' => ['key' => 'test-access', 'secret' => 'test-secret'],
            'use_path_style_endpoint' => true,
            'handler' => $mock,
        ]);

        $property = new \ReflectionProperty(CloudflareR2Service::class, 's3Client');
        $property->setAccessible(true);
        $property->setValue($service, $s3Client);

        return $service;
    }
}


