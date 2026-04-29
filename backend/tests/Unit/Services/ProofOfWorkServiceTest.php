<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\ProofOfWorkService;
use Monolog\Handler\NullHandler;
use Monolog\Logger;
use PDO;
use PHPUnit\Framework\TestCase;

class ProofOfWorkServiceTest extends TestCase
{
    public function testCreatesAndVerifiesChallenge(): void
    {
        $service = $this->makeService(8);
        $challenge = $service->createChallenge('auth.login');
        $nonce = $this->solve($challenge['challenge'], $challenge['difficulty']);

        $result = $service->verify($challenge['challenge'], $nonce, 'auth.login');

        $this->assertTrue($result['success']);
        $this->assertSame(8, $result['difficulty']);
    }

    public function testRejectsScopeMismatch(): void
    {
        $service = $this->makeService(8);
        $challenge = $service->createChallenge('auth.login');
        $nonce = $this->solve($challenge['challenge'], $challenge['difficulty']);

        $result = $service->verify($challenge['challenge'], $nonce, 'auth.register');

        $this->assertFalse($result['success']);
        $this->assertSame('scope-mismatch', $result['error']);
    }

    public function testRejectsReplayedChallengeWhenStoreIsAvailable(): void
    {
        $service = $this->makeService(8, $this->makeChallengeDatabase());
        $challenge = $service->createChallenge('auth.login');
        $nonce = $this->solve($challenge['challenge'], $challenge['difficulty']);

        $first = $service->verify($challenge['challenge'], $nonce, 'auth.login');
        $second = $service->verify($challenge['challenge'], $nonce, 'auth.login');

        $this->assertTrue($first['success']);
        $this->assertFalse($second['success']);
        $this->assertSame('replayed-challenge', $second['error']);
    }

    private function makeService(int $difficulty, ?PDO $db = null): ProofOfWorkService
    {
        $logger = new Logger('test');
        $logger->pushHandler(new NullHandler());

        return new ProofOfWorkService('test-secret', $logger, null, null, $difficulty, 120, $db);
    }

    private function makeChallengeDatabase(): PDO
    {
        $db = new PDO('sqlite::memory:');
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->exec(
            'CREATE TABLE proof_of_work_challenges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                challenge_id TEXT NOT NULL UNIQUE,
                challenge_hash TEXT NOT NULL,
                scope TEXT NOT NULL,
                difficulty INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT DEFAULT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )'
        );

        return $db;
    }

    private function solve(string $challenge, int $difficulty): string
    {
        for ($nonce = 0; $nonce < 1000000; $nonce++) {
            $hash = hash('sha256', $challenge . ':' . $nonce, true);
            if ($this->hasLeadingZeroBits($hash, $difficulty)) {
                return (string)$nonce;
            }
        }

        $this->fail('Unable to solve proof-of-work challenge in test budget');
    }

    private function hasLeadingZeroBits(string $hash, int $difficulty): bool
    {
        $fullBytes = intdiv($difficulty, 8);
        for ($i = 0; $i < $fullBytes; $i++) {
            if (ord($hash[$i]) !== 0) {
                return false;
            }
        }

        $remainingBits = $difficulty % 8;
        if ($remainingBits === 0) {
            return true;
        }

        $mask = 0xff << (8 - $remainingBits);
        return (ord($hash[$fullBytes]) & $mask) === 0;
    }
}
