<?php

declare(strict_types=1);

namespace CarbonTrack\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use CarbonTrack\Services\DatabaseService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Models\IdempotencyRecord;
use CarbonTrack\Support\SensitiveDataRedactor;
use Slim\Psr7\Response;
use Monolog\Logger;

class IdempotencyMiddleware implements MiddlewareInterface
{
    private const FINGERPRINT_MAX_DEPTH = 10;
    private const FINGERPRINT_MAX_ARRAY_ITEMS = 200;
    private const FINGERPRINT_MAX_STRING_BYTES = 8192;
    private const STREAM_HASH_CHUNK_BYTES = 8192;
    private const STREAM_HASH_MAX_BYTES = 1048576;

    private DatabaseService $db;
    private Logger $logger;
    private ?AuthService $authService;
    private array $idempotentMethods = ['POST', 'PUT', 'PATCH'];
    private array $idempotencyRoutes = [
        '/api/v1/auth/register',
        '/api/v1/carbon-track/record',
        '/api/v1/exchange',
        '/api/v1/messages/broadcast',
        '/api/v1/admin/messages'
    ];

    public function __construct(DatabaseService $db, Logger $logger, ?AuthService $authService = null)
    {
        $this->db = $db;
        $this->logger = $logger;
        $this->authService = $authService;
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $method = $request->getMethod();
        $uri = $request->getUri()->getPath();
        // Only apply idempotency to specific methods and routes
        if (!in_array($method, $this->idempotentMethods) || !$this->requiresIdempotency($uri)) {
            return $handler->handle($request);
        }

        $response = null;
        $idempotencyKey = $request->getHeaderLine('X-Request-ID');

        // Validate header presence and format; build error response if invalid
        if (empty($idempotencyKey)) {
            $response = $this->badRequestResponse('X-Request-ID header is required for this operation');
        } elseif (!$this->isValidUuid($idempotencyKey)) {
            $response = $this->badRequestResponse('X-Request-ID must be a valid UUID');
        } else {
            try {
                // B-106: bind replay lookup to the authenticated user identity
                // resolved from the bearer token (or the literal "anonymous"
                // bucket on auth-less routes) AND to the
                // request fingerprint (method + path + sha256(body/files)). Two users
                // colliding on the same UUID, or the same user replaying the UUID
                // against a different endpoint/body, must NOT see each other's
                // cached response.
                [$userIdentity, $request] = $this->resolveUserIdentity($request);
                $compositeKey = $this->buildCompositeKey($userIdentity, $method, $uri, $request);

                $query = IdempotencyRecord::where('idempotency_key', $idempotencyKey)
                    ->where('composite_key', $compositeKey)
                    ->where('user_id', $userIdentity)
                    ->where('created_at', '>', gmdate('Y-m-d H:i:s', strtotime('-24 hours'))); // Only check last 24 hours

                $existingRecord = $query->first();

                if ($existingRecord) {
                    $this->logger->info('Idempotent request detected', [
                        'idempotency_key' => $idempotencyKey,
                        'original_status' => $existingRecord->response_status,
                        'uri' => $uri
                    ]);

                    $resp = new Response();
                    $resp->getBody()->write($existingRecord->response_body);
                    $response = $resp
                        ->withStatus($existingRecord->response_status)
                        ->withHeader('Content-Type', 'application/json')
                        ->withHeader('X-Idempotent-Replay', 'true');
                } else {
                    // Process the request and store result for future replays
                    $response = $handler->handle($request);
                    $this->storeIdempotencyRecord($idempotencyKey, $compositeKey, $userIdentity, $request, $response);
                }
            } catch (\Throwable $e) {
                $this->logger->error('Idempotency middleware error', [
                    'error' => $e->getMessage(),
                    'idempotency_key' => $idempotencyKey,
                    'uri' => $uri
                ]);

                // Continue with normal processing if idempotency check fails
                $response = $handler->handle($request);
            }
        }

        return $response;
    }

    /**
     * Resolve the authenticated user identifier used for binding idempotency rows.
     * Returns a positive int for authenticated users, otherwise 0 for the
     * non-null "anonymous" bucket.
     */
    private function resolveUserIdentity(ServerRequestInterface $request): array
    {
        $userId = $request->getAttribute('user_id');
        if (is_int($userId) && $userId > 0) {
            return [$userId, $request];
        }
        if (is_string($userId) && ctype_digit($userId)) {
            $parsed = (int) $userId;
            return [$parsed > 0 ? $parsed : 0, $request];
        }

        $authHeader = $request->getHeaderLine('Authorization');
        if ($this->authService !== null && str_starts_with($authHeader, 'Bearer ')) {
            try {
                $payload = $this->authService->validateToken(trim(substr($authHeader, 7)));
                $tokenUserId = $this->normalizeUserId($payload['user_id'] ?? $payload['user']['id'] ?? null);
                if ($tokenUserId !== null) {
                    $request = $request
                        ->withAttribute('user_id', $payload['user_id'])
                        ->withAttribute('user_uuid', $payload['uuid'] ?? null)
                        ->withAttribute('user_email', $payload['email'] ?? null)
                        ->withAttribute('user_role', $payload['role'] ?? 'user')
                        ->withAttribute('authenticated_user', $payload['user'] ?? null)
                        ->withAttribute('user', $payload['user'] ?? null)
                        ->withAttribute('token_payload', $payload)
                        ->withAttribute('idempotency_validated_token', true);
                    return [$tokenUserId, $request];
                }
            } catch (\Throwable $e) {
                // Let route-level auth middleware own the eventual 401. For the
                // idempotency key, an invalid/absent token falls back to the
                // anonymous bucket rather than sharing a cached authenticated row.
            }
        }

        return [0, $request];
    }

    private function normalizeUserId($value): ?int
    {
        if (is_int($value) && $value > 0) {
            return $value;
        }
        if (is_string($value) && ctype_digit($value)) {
            $parsed = (int) $value;
            return $parsed > 0 ? $parsed : null;
        }
        return null;
    }

    private function buildCompositeKey(int $userIdentity, string $method, string $path, ServerRequestInterface $request): string
    {
        $bucket = $userIdentity === 0 ? 'anonymous' : (string) $userIdentity;
        $bodyHash = $this->fingerprintValue($request->getParsedBody());
        $filesHash = hash('sha256', $this->encodeForFingerprint(
            $this->normalizeUploadedFiles($request->getUploadedFiles())
        ));

        return hash('sha256', $bucket . '|' . strtoupper($method) . '|' . $path . '|' . $bodyHash . '|' . $filesHash);
    }

    /**
     * Hash parsed body values incrementally so the composite key does not need
     * to JSON-encode an arbitrary request body in one large allocation.
     *
     * @param mixed $value
     */
    private function fingerprintValue($value): string
    {
        $context = hash_init('sha256');
        $this->updateFingerprintHash($context, $value, 0);
        return hash_final($context);
    }

    /**
     * @param mixed $context
     * @param mixed $value
     */
    private function updateFingerprintHash($context, $value, int $depth): void
    {
        if ($depth > self::FINGERPRINT_MAX_DEPTH) {
            hash_update($context, 'depth:truncated;');
            return;
        }

        if (is_string($value)) {
            $length = strlen($value);
            $fingerprintValue = $length > self::FINGERPRINT_MAX_STRING_BYTES
                ? substr($value, 0, self::FINGERPRINT_MAX_STRING_BYTES)
                : $value;
            hash_update($context, 'string:' . $length . ':' . hash('sha256', $fingerprintValue) . ';');
            return;
        }

        if (is_array($value)) {
            hash_update($context, 'array:' . count($value) . ':{');
            if (!$this->isListArray($value)) {
                ksort($value);
            }
            $count = 0;
            foreach ($value as $key => $child) {
                if ($count >= self::FINGERPRINT_MAX_ARRAY_ITEMS) {
                    hash_update($context, 'truncated_items:' . (count($value) - self::FINGERPRINT_MAX_ARRAY_ITEMS) . ';');
                    break;
                }
                hash_update($context, 'key:' . (is_int($key) ? 'i' : 's') . ':' . (string) $key . ';');
                $this->updateFingerprintHash($context, $child, $depth + 1);
                $count++;
            }
            hash_update($context, '}');
            return;
        }

        if (is_object($value)) {
            hash_update($context, 'object:' . get_class($value) . ':{');
            $this->updateFingerprintHash($context, (array) $value, $depth + 1);
            hash_update($context, '}');
            return;
        }

        if (is_bool($value)) {
            hash_update($context, 'bool:' . ($value ? '1' : '0') . ';');
            return;
        }

        if ($value === null) {
            hash_update($context, 'null;');
            return;
        }

        hash_update($context, gettype($value) . ':' . (string) $value . ';');
    }

    /**
     * Build a bounded, stable representation before JSON encoding so unusually
     * large parsed bodies cannot make idempotency fingerprinting allocate
     * unbounded memory.
     *
     * @param mixed $value
     * @return mixed
     */
    private function normalizeForFingerprint($value, int $depth = 0)
    {
        if ($depth > self::FINGERPRINT_MAX_DEPTH) {
            return ['__truncated_depth' => true];
        }

        if (is_string($value)) {
            $length = strlen($value);
            if ($length <= self::FINGERPRINT_MAX_STRING_BYTES) {
                return $value;
            }

            return [
                '__type' => 'string',
                '__length' => $length,
                '__sha256' => hash('sha256', $value),
                '__prefix' => substr($value, 0, self::FINGERPRINT_MAX_STRING_BYTES),
            ];
        }

        if (is_array($value)) {
            $out = [];
            $count = 0;
            foreach ($value as $key => $child) {
                if ($count >= self::FINGERPRINT_MAX_ARRAY_ITEMS) {
                    $out['__truncated_items'] = count($value) - self::FINGERPRINT_MAX_ARRAY_ITEMS;
                    break;
                }
                $out[$key] = $this->normalizeForFingerprint($child, $depth + 1);
                $count++;
            }
            ksort($out);
            return $out;
        }

        if (is_object($value)) {
            return $this->normalizeForFingerprint((array) $value, $depth + 1);
        }

        return $value;
    }

    private function encodeForFingerprint($value): string
    {
        try {
            $json = json_encode(
                $value,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
            );
            return $json === false ? 'null' : $json;
        } catch (\Throwable $e) {
            return 'null';
        }
    }

    /**
     * @param array<string|int, mixed> $files
     * @return array<string|int, mixed>
     */
    private function normalizeUploadedFiles(array $files): array
    {
        $out = [];
        foreach ($files as $key => $value) {
            if ($value instanceof UploadedFileInterface) {
                $out[$key] = $this->fingerprintUploadedFile($value);
                continue;
            }
            if (is_array($value)) {
                $out[$key] = $this->normalizeUploadedFiles($value);
            }
        }
        ksort($out);
        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function fingerprintUploadedFile(UploadedFileInterface $file): array
    {
        return [
            'client_filename' => $file->getClientFilename(),
            'client_media_type' => $file->getClientMediaType(),
            'size' => $file->getSize(),
            'error' => $file->getError(),
            'sha256_prefix' => $this->hashUploadedFilePrefix($file),
            'hash_bytes' => self::STREAM_HASH_MAX_BYTES,
        ];
    }

    private function hashUploadedFilePrefix(UploadedFileInterface $file): ?string
    {
        if ($file->getError() !== UPLOAD_ERR_OK) {
            return null;
        }

        try {
            $stream = $file->getStream();
            if (!$stream->isReadable()) {
                return null;
            }
            if (!$stream->isSeekable()) {
                return null;
            }

            $position = $stream->tell();
            $stream->rewind();

            $context = hash_init('sha256');
            $bytesRead = 0;
            while (!$stream->eof() && $bytesRead < self::STREAM_HASH_MAX_BYTES) {
                $remaining = self::STREAM_HASH_MAX_BYTES - $bytesRead;
                $chunk = $stream->read(min(self::STREAM_HASH_CHUNK_BYTES, $remaining));
                if ($chunk === '') {
                    break;
                }
                $bytesRead += strlen($chunk);
                hash_update($context, $chunk);
            }

            $stream->seek($position);

            return hash_final($context);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function requiresIdempotency(string $uri): bool
    {
        foreach ($this->idempotencyRoutes as $route) {
            if (str_starts_with($uri, $route)) {
                return true;
            }
        }
        return false;
    }

    private function isValidUuid(string $uuid): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $uuid) === 1;
    }

    private function isListArray(array $value): bool
    {
        $expectedKey = 0;
        foreach ($value as $key => $_) {
            if ($key !== $expectedKey) {
                return false;
            }
            $expectedKey++;
        }
        return true;
    }

    private function storeIdempotencyRecord(string $idempotencyKey, string $compositeKey, int $userId, ServerRequestInterface $request, ResponseInterface $response): void
    {
        try {
            $statusCode = $response->getStatusCode();
            if ($statusCode < 200 || $statusCode >= 500 || $this->isTransientClientError($statusCode)) {
                return;
            }

            $responseBody = (string) $response->getBody();

            // Reset body stream position for subsequent reads
            $response->getBody()->rewind();

            IdempotencyRecord::create([
                'idempotency_key' => $idempotencyKey,
                'composite_key' => $compositeKey,
                'user_id' => $userId,
                'request_method' => $request->getMethod(),
                'request_uri' => $request->getUri()->getPath(),
                'request_body' => $this->encodeForFingerprint($this->normalizeForFingerprint(
                    SensitiveDataRedactor::redact($request->getParsedBody())
                )),
                'response_status' => $statusCode,
                'response_body' => $responseBody,
                'ip_address' => $this->getClientIp($request),
                'user_agent' => $request->getHeaderLine('User-Agent')
            ]);

        } catch (\Throwable $e) {
            $this->logger->error('Failed to store idempotency record', [
                'error' => $e->getMessage(),
                'idempotency_key' => $idempotencyKey
            ]);
        }
    }

    private function isTransientClientError(int $statusCode): bool
    {
        return in_array($statusCode, [409, 423, 425, 429], true);
    }

    private function badRequestResponse(string $message): ResponseInterface
    {
        $response = new Response();
        $response->getBody()->write(json_encode([
            'success' => false,
            'message' => $message,
            'code' => 'BAD_REQUEST'
        ]));
        
        return $response
            ->withStatus(400)
            ->withHeader('Content-Type', 'application/json');
    }

    private function getClientIp(ServerRequestInterface $request): string
    {
        $serverParams = $request->getServerParams();
        $remoteAddr = (string)($serverParams['REMOTE_ADDR'] ?? ($_SERVER['REMOTE_ADDR'] ?? ''));
        $fallback = ($remoteAddr !== '' && filter_var($remoteAddr, FILTER_VALIDATE_IP)) ? $remoteAddr : '0.0.0.0';

        if (!$this->isTrustedProxyAddress($fallback)) {
            return $fallback;
        }

        $cf = trim($request->getHeaderLine('CF-Connecting-IP'));
        if ($cf !== '' && filter_var($cf, FILTER_VALIDATE_IP)) {
            return $cf;
        }

        $forwarded = $this->resolveForwardedForClient($request->getHeaderLine('X-Forwarded-For'));
        if ($forwarded !== null) {
            return $forwarded;
        }

        return $fallback;
    }

    private function resolveForwardedForClient(string $header): ?string
    {
        $parts = array_values(array_filter(array_map('trim', explode(',', $header)), static fn ($part) => $part !== ''));
        if ($parts === []) {
            return null;
        }

        $leftmostValid = null;
        for ($i = count($parts) - 1; $i >= 0; $i--) {
            $candidate = $parts[$i];
            if (!filter_var($candidate, FILTER_VALIDATE_IP)) {
                continue;
            }
            $leftmostValid = $candidate;
            if (!$this->isTrustedProxyAddress($candidate)) {
                return $candidate;
            }
        }

        return $leftmostValid;
    }

    private function isTrustedProxyAddress(string $remoteAddr): bool
    {
        $trustedCidrs = trim((string)($_ENV['TRUSTED_PROXY_CIDRS'] ?? ''));
        if ($trustedCidrs === '' || $remoteAddr === '0.0.0.0') {
            return false;
        }

        foreach (preg_split('/\s*,\s*/', $trustedCidrs) ?: [] as $cidr) {
            if ($cidr !== '' && $this->ipMatchesCidr($remoteAddr, $cidr)) {
                return true;
            }
        }
        return false;
    }

    private function ipMatchesCidr(string $ip, string $cidr): bool
    {
        if (strpos($cidr, '/') === false) {
            return hash_equals($cidr, $ip);
        }

        [$network, $prefix] = explode('/', $cidr, 2);
        $ipBytes = @inet_pton($ip);
        $networkBytes = @inet_pton($network);
        if ($ipBytes === false || $networkBytes === false || strlen($ipBytes) !== strlen($networkBytes)) {
            return false;
        }

        $prefixLength = filter_var($prefix, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        if ($prefixLength === false || $prefixLength > strlen($ipBytes) * 8) {
            return false;
        }

        $fullBytes = intdiv($prefixLength, 8);
        $remainingBits = $prefixLength % 8;
        if ($fullBytes > 0 && substr($ipBytes, 0, $fullBytes) !== substr($networkBytes, 0, $fullBytes)) {
            return false;
        }
        if ($remainingBits === 0) {
            return true;
        }

        $mask = (0xff << (8 - $remainingBits)) & 0xff;
        return (ord($ipBytes[$fullBytes]) & $mask) === (ord($networkBytes[$fullBytes]) & $mask);
    }
}

