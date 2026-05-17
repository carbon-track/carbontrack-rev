<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Middleware;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Middleware\IdempotencyMiddleware;
use CarbonTrack\Models\IdempotencyRecord;
use CarbonTrack\Services\DatabaseService;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

class IdempotencyMiddlewareTest extends TestCase
{
    private static ?Capsule $capsule = null;

    public static function setUpBeforeClass(): void
    {
        if (self::$capsule !== null) {
            return;
        }
        $capsule = new Capsule();
        $capsule->addConnection([
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ]);
        $capsule->setAsGlobal();
        $capsule->bootEloquent();

        $capsule->schema()->create('idempotency_records', function (Blueprint $t) {
            $t->increments('id');
            $t->string('idempotency_key', 36);
            $t->string('composite_key', 64)->nullable();
            $t->integer('user_id')->nullable();
            $t->string('request_method', 10);
            $t->string('request_uri', 512);
            $t->text('request_body')->nullable();
            $t->integer('response_status');
            $t->text('response_body');
            $t->string('ip_address', 45)->nullable();
            $t->string('user_agent', 512)->nullable();
            $t->timestamps();
            $t->index(['idempotency_key', 'user_id'], 'idx_idempotency_key_user');
        });

        self::$capsule = $capsule;
    }

    protected function setUp(): void
    {
        parent::setUp();
        if (self::$capsule !== null) {
            self::$capsule->table('idempotency_records')->delete();
        }
    }

    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(IdempotencyMiddleware::class));
    }

    public function testMissingRequestIdReturns400(): void
    {
        // DatabaseService not used directly in current implementation; pass a dummy stub
        $db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $logger = $this->createMock(\Monolog\Logger::class);
        $mw = new IdempotencyMiddleware($db, $logger);

        $request = makeRequest('POST', '/api/v1/auth/register');
        $handler = $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class);
        $resp = $mw->process($request, $handler);
        $this->assertEquals(400, $resp->getStatusCode());
    }

    public function testPassthroughWhenNotSensitive(): void
    {
        $db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $logger = $this->createMock(\Monolog\Logger::class);
        $mw = new IdempotencyMiddleware($db, $logger);

        $request = makeRequest('POST', '/api/v1/others');
        $handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface {
                $resp = new \Slim\Psr7\Response();
                $resp->getBody()->write('{"ok":true}');
                return $resp->withHeader('Content-Type','application/json');
            }
        };

        $resp = $mw->process($request, $handler);
        $this->assertEquals(200, $resp->getStatusCode());
    }

    public function testInvalidRequestIdFormatReturns400(): void
    {
        $db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $logger = $this->createMock(\Monolog\Logger::class);
        $mw = new IdempotencyMiddleware($db, $logger);

        $request = makeRequest('POST', '/api/v1/exchange', null, null, [
            'X-Request-ID' => ['not-a-uuid']
        ]);
        $handler = $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class);
        $resp = $mw->process($request, $handler);
        $this->assertEquals(400, $resp->getStatusCode());
    }

    public function testSensitiveWithValidUuidPassesThroughAndStoresSafely(): void
    {
        $db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $logger = $this->createMock(\Monolog\Logger::class);
        $mw = new IdempotencyMiddleware($db, $logger);

        $uuid = '123e4567-e89b-12d3-a456-426614174000';
        $request = makeRequest('POST', '/api/v1/exchange', ['a' => 1], null, [
            'X-Request-ID' => [$uuid],
            'User-Agent' => ['PHPUnit']
        ]);

        $handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface {
                $resp = new \Slim\Psr7\Response(201);
                $resp->getBody()->write('{"success":true}');
                return $resp->withHeader('Content-Type','application/json');
            }
        };

        $resp = $mw->process($request, $handler);
        $this->assertEquals(201, $resp->getStatusCode());
        $this->assertEquals('application/json', $resp->getHeaderLine('Content-Type'));
        // Sanity: the row should now be persisted with composite_key + user_id
        $this->assertSame(1, IdempotencyRecord::query()->count());
    }

    public function testReplayingSameUuidAcrossUsersDoesNotShareCachedResponse(): void
    {
        $db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $logger = $this->createMock(\Monolog\Logger::class);
        $mw = new IdempotencyMiddleware($db, $logger);

        $uuid = '123e4567-e89b-12d3-a456-426614174001';

        $invocationCount = 0;
        $handlerFor = function (string $body) use (&$invocationCount) {
            return new class($body, $invocationCount) implements \Psr\Http\Server\RequestHandlerInterface {
                public function __construct(private string $body, public int &$invocationCount)
                {
                }
                public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface
                {
                    $this->invocationCount++;
                    $resp = new \Slim\Psr7\Response(200);
                    $resp->getBody()->write($this->body);
                    return $resp->withHeader('Content-Type', 'application/json');
                }
            };
        };

        // User A submits with UUID + body{"a":1}; gets back response A.
        $userARequest = makeRequest('POST', '/api/v1/messages/broadcast', ['a' => 1], null, [
            'X-Request-ID' => [$uuid],
        ])->withAttribute('user_id', 101);
        $handlerA = $handlerFor('{"resp":"A","secret":"only-for-A"}');
        $respA = $mw->process($userARequest, $handlerA);
        $this->assertSame(200, $respA->getStatusCode());
        $bodyA = (string) $respA->getBody();
        $this->assertStringContainsString('only-for-A', $bodyA);

        // User B submits the exact same UUID + same body but as a different user.
        // Must NOT see user A's cached body, must run the handler again.
        $userBRequest = makeRequest('POST', '/api/v1/messages/broadcast', ['a' => 1], null, [
            'X-Request-ID' => [$uuid],
        ])->withAttribute('user_id', 202);
        $handlerB = $handlerFor('{"resp":"B"}');
        $respB = $mw->process($userBRequest, $handlerB);
        $this->assertSame(200, $respB->getStatusCode());
        $bodyB = (string) $respB->getBody();
        $this->assertStringContainsString('"B"', $bodyB);
        $this->assertStringNotContainsString('only-for-A', $bodyB);
        $this->assertNotSame('true', $respB->getHeaderLine('X-Idempotent-Replay'));
    }

    public function testSameUserReplayingSameUuidStillReturnsCachedResponse(): void
    {
        $db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $logger = $this->createMock(\Monolog\Logger::class);
        $mw = new IdempotencyMiddleware($db, $logger);

        $uuid = '123e4567-e89b-12d3-a456-426614174002';

        $callCounter = 0;
        $handler = new class($callCounter) implements \Psr\Http\Server\RequestHandlerInterface {
            public function __construct(public int &$count)
            {
            }
            public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface
            {
                $this->count++;
                $resp = new \Slim\Psr7\Response(201);
                $resp->getBody()->write('{"resp":"first-only"}');
                return $resp->withHeader('Content-Type', 'application/json');
            }
        };

        $first = makeRequest('POST', '/api/v1/messages/broadcast', ['a' => 1], null, [
            'X-Request-ID' => [$uuid],
        ])->withAttribute('user_id', 999);
        $resp1 = $mw->process($first, $handler);

        $second = makeRequest('POST', '/api/v1/messages/broadcast', ['a' => 1], null, [
            'X-Request-ID' => [$uuid],
        ])->withAttribute('user_id', 999);
        $resp2 = $mw->process($second, $handler);

        $this->assertSame(201, $resp1->getStatusCode());
        $this->assertSame(201, $resp2->getStatusCode());
        $this->assertSame('true', $resp2->getHeaderLine('X-Idempotent-Replay'));
        $this->assertSame(1, $callCounter, 'Handler should run only once when same user replays same UUID');
        $this->assertStringContainsString('first-only', (string) $resp2->getBody());
    }

    public function testSameUserCanReplayEarlierPayloadAfterUuidWasUsedForDifferentBody(): void
    {
        $db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $logger = $this->createMock(\Monolog\Logger::class);
        $mw = new IdempotencyMiddleware($db, $logger);

        $uuid = '123e4567-e89b-12d3-a456-426614174003';
        $callCounter = 0;
        $handler = new class($callCounter) implements \Psr\Http\Server\RequestHandlerInterface {
            public function __construct(public int &$count)
            {
            }
            public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface
            {
                $this->count++;
                $body = $request->getParsedBody();
                $resp = new \Slim\Psr7\Response(200);
                $resp->getBody()->write(json_encode(['variant' => $body['variant'] ?? 'unknown']));
                return $resp->withHeader('Content-Type', 'application/json');
            }
        };

        $headers = ['X-Request-ID' => [$uuid]];
        $firstB = makeRequest('POST', '/api/v1/messages/broadcast', ['variant' => 'B'], null, $headers)
            ->withAttribute('user_id', 777);
        $firstA = makeRequest('POST', '/api/v1/messages/broadcast', ['variant' => 'A'], null, $headers)
            ->withAttribute('user_id', 777);
        $retryA = makeRequest('POST', '/api/v1/messages/broadcast', ['variant' => 'A'], null, $headers)
            ->withAttribute('user_id', 777);

        $mw->process($firstB, $handler);
        $respA1 = $mw->process($firstA, $handler);
        $respA2 = $mw->process($retryA, $handler);

        $this->assertSame(2, $callCounter, 'Retrying the second payload should replay its matching composite row');
        $this->assertNotSame('true', $respA1->getHeaderLine('X-Idempotent-Replay'));
        $this->assertSame('true', $respA2->getHeaderLine('X-Idempotent-Replay'));
        $this->assertStringContainsString('"A"', (string) $respA2->getBody());
    }

    public function testMultipartUploadsWithDifferentFilesUseDifferentCompositeKeys(): void
    {
        $db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $logger = $this->createMock(\Monolog\Logger::class);
        $mw = new IdempotencyMiddleware($db, $logger);

        $uuid = '123e4567-e89b-12d3-a456-426614174004';
        $callCounter = 0;
        $handler = new class($callCounter) implements \Psr\Http\Server\RequestHandlerInterface {
            public function __construct(public int &$count)
            {
            }
            public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface
            {
                $this->count++;
                $resp = new \Slim\Psr7\Response(201);
                $resp->getBody()->write(json_encode(['count' => $this->count]));
                return $resp->withHeader('Content-Type', 'application/json');
            }
        };

        $headers = ['X-Request-ID' => [$uuid]];
        $first = makeRequest('POST', '/api/v1/carbon-track/record', ['amount' => 1], null, $headers)
            ->withAttribute('user_id', 123)
            ->withUploadedFiles(['proof' => $this->makeUploadedFile('proof-a.png', 'image-a')]);
        $second = makeRequest('POST', '/api/v1/carbon-track/record', ['amount' => 1], null, $headers)
            ->withAttribute('user_id', 123)
            ->withUploadedFiles(['proof' => $this->makeUploadedFile('proof-a.png', 'image-b')]);

        $mw->process($first, $handler);
        $resp2 = $mw->process($second, $handler);

        $this->assertSame(2, $callCounter);
        $this->assertNotSame('true', $resp2->getHeaderLine('X-Idempotent-Replay'));
        $this->assertStringContainsString('"count":2', (string) $resp2->getBody());
    }

    private function makeUploadedFile(string $clientFilename, string $contents): \Psr\Http\Message\UploadedFileInterface
    {
        return new class($clientFilename, $contents) implements \Psr\Http\Message\UploadedFileInterface {
            private \Slim\Psr7\Stream $stream;

            public function __construct(private string $clientFilename, string $contents)
            {
                $resource = fopen('php://temp', 'r+');
                fwrite($resource, $contents);
                rewind($resource);
                $this->stream = new \Slim\Psr7\Stream($resource);
            }

            public function getStream(): \Psr\Http\Message\StreamInterface
            {
                return $this->stream;
            }

            public function moveTo($targetPath): void
            {
                throw new \RuntimeException('Not needed for tests');
            }

            public function getSize(): ?int
            {
                return $this->stream->getSize();
            }

            public function getError(): int
            {
                return UPLOAD_ERR_OK;
            }

            public function getClientFilename(): ?string
            {
                return $this->clientFilename;
            }

            public function getClientMediaType(): ?string
            {
                return 'image/png';
            }
        };
    }
}


