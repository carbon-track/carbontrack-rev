<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\User;
use CarbonTrack\Models\UserNotificationPreference;
use Monolog\Logger;

class NotificationPreferenceService
{
    public const CATEGORY_VERIFICATION = 'verification';
    public const CATEGORY_SECURITY = 'security';
    public const CATEGORY_SYSTEM = 'system';
    public const CATEGORY_TRANSACTION = 'transaction';
    public const CATEGORY_ACTIVITY = 'activity';
    public const CATEGORY_ANNOUNCEMENT = 'announcement';
    public const CATEGORY_MESSAGE = 'message';

    /**
     * @var array<string, array{label:string, locked:bool}>
     */
    private const CATEGORY_DEFINITIONS = [
        self::CATEGORY_VERIFICATION => ['label' => 'Account verification', 'locked' => true],
        self::CATEGORY_SECURITY => ['label' => 'Security alerts', 'locked' => true],
        self::CATEGORY_SYSTEM => ['label' => 'System updates', 'locked' => false],
        self::CATEGORY_TRANSACTION => ['label' => 'Point exchanges', 'locked' => false],
        self::CATEGORY_ACTIVITY => ['label' => 'Activity reviews', 'locked' => false],
        self::CATEGORY_ANNOUNCEMENT => ['label' => 'Announcements', 'locked' => false],
        self::CATEGORY_MESSAGE => ['label' => 'Direct messages', 'locked' => true],
    ];

    /**
     * @var array<int, array<string, bool>>
     */
    private array $emailPreferenceCache = [];
    /**
     * @var array<string, int>
     */
    private array $userIdByEmailCache = [];

    private Logger $logger;

    public function __construct(Logger $logger)
    {
        $this->logger = $logger;
    }

    /**
     * @return array<string, array{label:string, locked:bool}>
     */
    public function allCategories(): array
    {
        return self::CATEGORY_DEFINITIONS;
    }

    /**
     * @return array<int, array{category:string,label:string,locked:bool,email_enabled:bool}>
     */
    public function getPreferencesForUser(int $userId): array
    {
        $records = UserNotificationPreference::query()
            ->where('user_id', $userId)
            ->get(['category', 'email_enabled'])
            ->pluck('email_enabled', 'category')
            ->map(fn($value) => (bool) $value)
            ->toArray();

        $result = [];
        foreach (self::CATEGORY_DEFINITIONS as $category => $meta) {
            $result[] = [
                'category' => $category,
                'label' => $meta['label'],
                'locked' => $meta['locked'],
                'email_enabled' => $meta['locked'] ? true : ($records[$category] ?? true),
            ];
        }

        return $result;
    }

    /**
     * @param array<int, array{category:string,email_enabled:bool}> $preferences
     */
    public function updatePreferences(int $userId, array $preferences): void
    {
        $allowed = self::CATEGORY_DEFINITIONS;
        $toUpsert = [];

        foreach ($preferences as $entry) {
            $category = (string) ($entry['category'] ?? '');
            if (!isset($allowed[$category])) {
                continue;
            }

            if ($allowed[$category]['locked']) {
                continue;
            }

            $enabled = (bool) ($entry['email_enabled'] ?? true);
            $toUpsert[$category] = $enabled;
        }

        if (!empty($toUpsert)) {
            foreach ($toUpsert as $category => $enabled) {
                UserNotificationPreference::query()->updateOrCreate(
                    [
                        'user_id' => $userId,
                        'category' => $category,
                    ],
                    [
                        'email_enabled' => $enabled,
                    ]
                );
            }
        }

        $this->emailPreferenceCache[$userId] = [];
    }

    public function shouldSendEmailByEmail(string $email, string $category): bool
    {
        $category = trim($category);
        if ($category === '' || !isset(self::CATEGORY_DEFINITIONS[$category])) {
            return true;
        }

        if (self::CATEGORY_DEFINITIONS[$category]['locked']) {
            return true;
        }

        if (!isset($this->userIdByEmailCache[$email])) {
            $user = User::query()
                ->where('email', $email)
                ->whereNull('deleted_at')
                ->first(['id']);

            $this->userIdByEmailCache[$email] = $user ? (int) $user->id : 0;
        }

        $userId = $this->userIdByEmailCache[$email];
        if ($userId === 0) {
            return true;
        }

        return $this->shouldSendEmail($userId, $category);
    }

    public function shouldSendEmail(int $userId, string $category): bool
    {
        if (!isset(self::CATEGORY_DEFINITIONS[$category])) {
            return true;
        }

        if (self::CATEGORY_DEFINITIONS[$category]['locked']) {
            return true;
        }

        if (!isset($this->emailPreferenceCache[$userId])) {
            $this->emailPreferenceCache[$userId] = UserNotificationPreference::query()
                ->where('user_id', $userId)
                ->get(['category', 'email_enabled'])
                ->pluck('email_enabled', 'category')
                ->map(fn($value) => (bool) $value)
                ->toArray();
        }

        return $this->emailPreferenceCache[$userId][$category] ?? true;
    }
}
