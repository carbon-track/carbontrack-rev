<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use Monolog\Logger;
use PDO;

class MobileDeviceSessionService
{
    private const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

    public function __construct(
        private PDO $db,
        private Logger $logger,
        private ?AuditLogService $auditLogService = null,
        private ?ErrorLogService $errorLogService = null,
        private int $refreshTtlSeconds = self::DEFAULT_REFRESH_TTL_SECONDS,
        private string $hashSecret = ''
    ) {
        if ($this->refreshTtlSeconds <= 0) {
            $this->refreshTtlSeconds = self::DEFAULT_REFRESH_TTL_SECONDS;
        }
        if ($this->hashSecret === '') {
            $this->hashSecret = $_ENV['JWT_SECRET'] ?? 'carbontrack-mobile-session-fallback';
        }
    }

    public function createSession(int $userId, array $metadata = []): array
    {
        $token = $this->generateRefreshToken();
        $now = $this->now();
        $expiresAt = $this->formatTimestamp(time() + $this->refreshTtlSeconds);

        $stmt = $this->db->prepare(
            'INSERT INTO mobile_device_sessions (
                user_id, refresh_token_hash, previous_refresh_token_hash, device_id, device_name,
                platform, user_agent, ip_address, expires_at, last_used_at, revoked_at,
                revoked_reason, created_at, updated_at
            ) VALUES (
                :user_id, :refresh_token_hash, NULL, :device_id, :device_name,
                :platform, :user_agent, :ip_address, :expires_at, :last_used_at, NULL,
                NULL, :created_at, :updated_at
            )'
        );
        $stmt->execute([
            'user_id' => $userId,
            'refresh_token_hash' => $this->hashToken($token),
            'device_id' => $this->normalizeNullableString($metadata['device_id'] ?? null, 191),
            'device_name' => $this->normalizeNullableString($metadata['device_name'] ?? null, 191),
            'platform' => $this->normalizeNullableString($metadata['platform'] ?? null, 64),
            'user_agent' => $this->normalizeNullableString($metadata['user_agent'] ?? null, 255),
            'ip_address' => $this->normalizeNullableString($metadata['ip_address'] ?? null, 64),
            'expires_at' => $expiresAt,
            'last_used_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $sessionId = (int) $this->db->lastInsertId();

        return [
            'refresh_token' => $token,
            'refresh_token_type' => 'bearer',
            'refresh_expires_in' => $this->refreshTtlSeconds,
            'device_session' => [
                'id' => $sessionId,
                'device_id' => $this->normalizeNullableString($metadata['device_id'] ?? null, 191),
                'device_name' => $this->normalizeNullableString($metadata['device_name'] ?? null, 191),
                'platform' => $this->normalizeNullableString($metadata['platform'] ?? null, 64),
                'expires_at' => $expiresAt,
            ],
        ];
    }

    public function rotateRefreshToken(string $refreshToken, array $metadata = []): ?array
    {
        $hash = $this->hashToken($refreshToken);
        $now = $this->now();
        $session = $this->findActiveSessionByHash($hash, $now);
        if ($session === null) {
            $this->revokeSessionByPreviousHash($hash, 'refresh_token_reuse_detected');
            return null;
        }

        $newToken = $this->generateRefreshToken();
        $expiresAt = $this->formatTimestamp(time() + $this->refreshTtlSeconds);
        $stmt = $this->db->prepare(
            'UPDATE mobile_device_sessions
             SET refresh_token_hash = :refresh_token_hash,
                 previous_refresh_token_hash = :previous_refresh_token_hash,
                 device_name = COALESCE(:device_name, device_name),
                 platform = COALESCE(:platform, platform),
                 user_agent = COALESCE(:user_agent, user_agent),
                 ip_address = COALESCE(:ip_address, ip_address),
                 expires_at = :expires_at,
                 last_used_at = :last_used_at,
                 updated_at = :updated_at
             WHERE id = :id
               AND refresh_token_hash = :previous_refresh_token_hash
               AND revoked_at IS NULL
               AND expires_at > :now'
        );
        $stmt->execute([
            'refresh_token_hash' => $this->hashToken($newToken),
            'previous_refresh_token_hash' => $hash,
            'device_name' => $this->normalizeNullableString($metadata['device_name'] ?? null, 191),
            'platform' => $this->normalizeNullableString($metadata['platform'] ?? null, 64),
            'user_agent' => $this->normalizeNullableString($metadata['user_agent'] ?? null, 255),
            'ip_address' => $this->normalizeNullableString($metadata['ip_address'] ?? null, 64),
            'expires_at' => $expiresAt,
            'last_used_at' => $now,
            'updated_at' => $now,
            'now' => $now,
            'id' => (int) $session['id'],
        ]);
        if ($stmt->rowCount() !== 1) {
            $this->revokeSessionByPreviousHash($hash, 'refresh_token_reuse_detected');
            return null;
        }

        return [
            'session' => [
                'id' => (int) $session['id'],
                'user_id' => (int) $session['user_id'],
                'device_id' => $session['device_id'] ?? null,
                'device_name' => $session['device_name'] ?? null,
                'platform' => $session['platform'] ?? null,
                'expires_at' => $expiresAt,
            ],
            'refresh_token' => $newToken,
            'refresh_token_type' => 'bearer',
            'refresh_expires_in' => $this->refreshTtlSeconds,
        ];
    }

    public function revokeByRefreshToken(string $refreshToken, string $reason = 'logout'): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE mobile_device_sessions
             SET revoked_at = :revoked_at, revoked_reason = :revoked_reason, updated_at = :updated_at
             WHERE refresh_token_hash = :refresh_token_hash AND revoked_at IS NULL'
        );
        $now = $this->now();
        $stmt->execute([
            'revoked_at' => $now,
            'revoked_reason' => $reason,
            'updated_at' => $now,
            'refresh_token_hash' => $this->hashToken($refreshToken),
        ]);

        return $stmt->rowCount() > 0;
    }

    private function findActiveSessionByHash(string $hash, string $now): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM mobile_device_sessions
             WHERE refresh_token_hash = :refresh_token_hash
               AND revoked_at IS NULL
               AND expires_at > :now
             LIMIT 1'
        );
        $stmt->execute([
            'refresh_token_hash' => $hash,
            'now' => $now,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    private function revokeSessionByPreviousHash(string $hash, string $reason): void
    {
        $stmt = $this->db->prepare(
            'UPDATE mobile_device_sessions
             SET revoked_at = :revoked_at, revoked_reason = :revoked_reason, updated_at = :updated_at
             WHERE previous_refresh_token_hash = :previous_refresh_token_hash AND revoked_at IS NULL'
        );
        $now = $this->now();
        $stmt->execute([
            'revoked_at' => $now,
            'revoked_reason' => $reason,
            'updated_at' => $now,
            'previous_refresh_token_hash' => $hash,
        ]);

        if ($stmt->rowCount() > 0) {
            $this->logger->warning('Mobile refresh token reuse detected; session revoked');
        }
    }

    private function hashToken(string $token): string
    {
        return hash_hmac('sha256', $token, $this->hashSecret);
    }

    private function generateRefreshToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    }

    private function now(): string
    {
        return $this->formatTimestamp(time());
    }

    private function formatTimestamp(int $timestamp): string
    {
        return gmdate('Y-m-d H:i:s', $timestamp);
    }

    private function normalizeNullableString(mixed $value, int $maxLength): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, $maxLength, 'UTF-8');
        }

        return substr($value, 0, $maxLength);
    }
}
