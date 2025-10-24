<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Services\Ai\LlmClientInterface;
use JsonException;
use Psr\Log\LoggerInterface;

class AdminAiIntentService
{
    private const NAVIGATION_TARGETS = [
        'dashboard' => [
            'id' => 'dashboard',
            'label' => 'Admin Dashboard',
            'route' => '/admin/dashboard',
            'description' => 'Overall administration overview with key metrics and quick tasks.',
            'keywords' => ['dashboard', 'overview', 'summary', '仪表盘', '总览', '首页'],
        ],
        'users' => [
            'id' => 'users',
            'label' => 'User Management',
            'route' => '/admin/users',
            'description' => 'Manage users, roles, points, and account status.',
            'keywords' => ['user', 'account', '用户', '管理用户', '权限'],
        ],
        'activities' => [
            'id' => 'activities',
            'label' => 'Activity Review',
            'route' => '/admin/activities',
            'description' => 'Review and moderate carbon reduction activity submissions.',
            'keywords' => ['activity', 'review', '碳减排', '审批', '活动'],
        ],
        'products' => [
            'id' => 'products',
            'label' => 'Reward Store',
            'route' => '/admin/products',
            'description' => 'Manage redemption products, inventory and pricing.',
            'keywords' => ['store', 'product', '奖励', '兑换'],
        ],
        'badges' => [
            'id' => 'badges',
            'label' => 'Badge Management',
            'route' => '/admin/badges',
            'description' => 'Create, edit and award achievement badges.',
            'keywords' => ['badge', '荣誉', '勋章', 'create badge', '颁发'],
        ],
        'avatars' => [
            'id' => 'avatars',
            'label' => 'Avatar Library',
            'route' => '/admin/avatars',
            'description' => 'Manage avatar assets and default selections.',
            'keywords' => ['avatar', '头像'],
        ],
        'exchanges' => [
            'id' => 'exchanges',
            'label' => 'Exchange Orders',
            'route' => '/admin/exchanges',
            'description' => 'Review redemption requests and update fulfilment status.',
            'keywords' => ['order', 'exchange', '兑换申请', '物流'],
        ],
        'broadcast' => [
            'id' => 'broadcast',
            'label' => 'Broadcast Center',
            'route' => '/admin/broadcast',
            'description' => 'Compose and send system broadcast messages.',
            'keywords' => ['broadcast', '通知', 'announcement', '群发'],
        ],
        'systemLogs' => [
            'id' => 'systemLogs',
            'label' => 'System Logs',
            'route' => '/admin/system-logs',
            'description' => 'Inspect audit logs and request traces.',
            'keywords' => ['log', '日志', '监控', '审计'],
        ],
    ];

    private const QUICK_ACTIONS = [
        'search-users' => [
            'id' => 'search-users',
            'label' => 'Search users',
            'description' => 'Focus the user search box for quick lookup.',
            'routeId' => 'users',
            'route' => '/admin/users',
            'mode' => 'shortcut',
            'query' => ['focus' => 'search'],
            'keywords' => ['search user', 'find user', '查找用户', '搜用户'],
        ],
        'create-badge' => [
            'id' => 'create-badge',
            'label' => 'Create new badge',
            'description' => 'Open the badge creation modal.',
            'routeId' => 'badges',
            'route' => '/admin/badges',
            'mode' => 'shortcut',
            'query' => ['create' => '1'],
            'keywords' => ['new badge', 'badge builder', '创建徽章'],
        ],
        'pending-activities' => [
            'id' => 'pending-activities',
            'label' => 'Review pending activities',
            'description' => 'Filter activity review list to pending items.',
            'routeId' => 'activities',
            'route' => '/admin/activities',
            'mode' => 'shortcut',
            'query' => ['filter' => 'pending'],
            'keywords' => ['待审批', 'pending', '审核活动'],
        ],
        'compose-broadcast' => [
            'id' => 'compose-broadcast',
            'label' => 'Compose broadcast',
            'description' => 'Open the broadcast composer.',
            'routeId' => 'broadcast',
            'route' => '/admin/broadcast',
            'mode' => 'shortcut',
            'query' => ['compose' => '1'],
            'keywords' => ['广播', 'announcement', 'new broadcast'],
        ],
    ];

    private const ACTION_DEFINITIONS = [
        'approve_carbon_records' => [
            'name' => 'approve_carbon_records',
            'label' => 'Approve carbon reduction records',
            'description' => 'Approve one or more pending carbon reduction activity submissions by record id.',
            'api' => [
                'method' => 'PUT',
                'path' => '/api/v1/admin/activities/review',
                'payloadTemplate' => [
                    'action' => 'approve',
                    'record_ids' => [],
                    'review_note' => null,
                ],
            ],
            'requires' => ['record_ids'],
            'contextHints' => ['selectedRecordIds'],
            'autoExecute' => true,
        ],
        'reject_carbon_records' => [
            'name' => 'reject_carbon_records',
            'label' => 'Reject carbon reduction records',
            'description' => 'Reject one or more pending carbon reduction records with an optional note.',
            'api' => [
                'method' => 'PUT',
                'path' => '/api/v1/admin/activities/review',
                'payloadTemplate' => [
                    'action' => 'reject',
                    'record_ids' => [],
                    'review_note' => null,
                ],
            ],
            'requires' => ['record_ids'],
            'contextHints' => ['selectedRecordIds'],
            'autoExecute' => true,
        ],
    ];

    private const ALLOWED_CONTEXT_KEYS = [
        'activeRoute',
        'selectedRecordIds',
        'selectedUserId',
        'locale',
        'timezone',
    ];

    public function __construct(
        private ?LlmClientInterface $client,
        private LoggerInterface $logger,
        private array $config = []
    ) {
        $this->model = (string)($config['model'] ?? 'gpt-4o-mini');
        $this->temperature = isset($config['temperature']) ? (float)$config['temperature'] : 0.2;
        $this->maxTokens = isset($config['max_tokens']) ? (int)$config['max_tokens'] : 800;
        $this->enabled = $client !== null;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    /**
     * @param array<string,mixed> $context
     * @return array<string,mixed>
     */
    public function analyzeIntent(string $query, array $context = []): array
    {
        if (!$this->enabled) {
            throw new \RuntimeException('AI intent service is disabled');
        }

        $payload = [
            'model' => $this->model,
            'temperature' => $this->temperature,
            'max_tokens' => $this->maxTokens,
            'messages' => $this->buildMessages($query, $context),
            'response_format' => ['type' => 'json_object'],
        ];

        try {
            $rawResponse = $this->client->createChatCompletion($payload);
        } catch (\Throwable $e) {
            $this->logger->error('Admin AI intent call failed', [
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);
            throw new \RuntimeException('LLM_UNAVAILABLE', 0, $e);
        }

        $content = $rawResponse['choices'][0]['message']['content'] ?? null;
        if (!is_string($content) || trim($content) === '') {
            $this->logger->warning('Admin AI intent returned empty content', [
                'raw' => $rawResponse,
            ]);
            return $this->fallbackIntent($query);
        }

        try {
            $decoded = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            $this->logger->warning('Admin AI intent JSON decode failed', [
                'content' => $content,
                'error' => $e->getMessage(),
            ]);
            return $this->fallbackIntent($query);
        }

        return $this->normalizeResult($decoded, $rawResponse);
    }

    /**
     * @param array<string,mixed> $context
     * @return array<int,array<string,string>>
     */
    private function buildMessages(string $query, array $context): array
    {
        $systemPrompt = $this->buildSystemPrompt();
        $fewShot = $this->buildFewShotMessages();
        $userPayload = $this->buildUserPayload($query, $context);

        $messages = [
            [
                'role' => 'system',
                'content' => $systemPrompt,
            ],
        ];

        foreach ($fewShot as $message) {
            $messages[] = $message;
        }

        $messages[] = [
            'role' => 'user',
            'content' => $userPayload,
        ];

        return $messages;
    }

    /**
     * @return array<int,array<string,string>>
     */
    private function buildFewShotMessages(): array
    {
        $exampleContext = json_encode([
            'query' => '帮我审批ID为 182 和 196 的碳减排活动',
            'context' => [
                'selectedRecordIds' => [150],
                'activeRoute' => '/admin/activities',
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $exampleResponse = json_encode([
            'intent' => [
                'type' => 'action',
                'label' => 'Approve 2 carbon reduction records',
                'confidence' => 0.83,
                'reasoning' => 'The user explicitly asks to approve activities 182 and 196.',
                'action' => [
                    'name' => 'approve_carbon_records',
                    'summary' => 'Approve records 182 and 196',
                    'api' => [
                        'method' => 'PUT',
                        'path' => '/api/v1/admin/activities/review',
                        'payload' => [
                            'action' => 'approve',
                            'record_ids' => [182, 196],
                            'review_note' => null,
                        ],
                    ],
                    'autoExecute' => true,
                ],
                'missing' => [],
            ],
            'alternatives' => [],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return [
            [
                'role' => 'user',
                'content' => $exampleContext,
            ],
            [
                'role' => 'assistant',
                'content' => $exampleResponse,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $context
     */
    private function buildUserPayload(string $query, array $context): string
    {
        $filteredContext = array_intersect_key($context, array_flip(self::ALLOWED_CONTEXT_KEYS));

        return json_encode([
            'query' => $query,
            'context' => $filteredContext,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function buildSystemPrompt(): string
    {
        $capabilities = [
            'navigationTargets' => array_values(array_map(
                fn (array $target) => [
                    'id' => $target['id'],
                    'label' => $target['label'],
                    'route' => $target['route'],
                    'description' => $target['description'],
                    'keywords' => $target['keywords'],
                ],
                self::NAVIGATION_TARGETS
            )),
            'quickActions' => array_values(array_map(
                fn (array $action) => [
                    'id' => $action['id'],
                    'label' => $action['label'],
                    'routeId' => $action['routeId'],
                    'route' => $action['route'],
                    'mode' => $action['mode'],
                    'query' => $action['query'],
                    'description' => $action['description'],
                    'keywords' => $action['keywords'],
                ],
                self::QUICK_ACTIONS
            )),
            'managementActions' => array_values(array_map(
                fn (array $definition) => [
                    'name' => $definition['name'],
                    'label' => $definition['label'],
                    'description' => $definition['description'],
                    'api' => $definition['api'],
                    'requires' => $definition['requires'],
                    'contextHints' => $definition['contextHints'],
                    'autoExecute' => $definition['autoExecute'],
                ],
                self::ACTION_DEFINITIONS
            )),
            'responseSchema' => [
                'intent' => [
                    'type' => 'navigate|quick_action|action|fallback',
                    'label' => 'human readable title',
                    'confidence' => 'number 0-1',
                    'reasoning' => 'short explanation',
                    'target' => [
                        'routeId' => 'for navigation/quick actions',
                        'route' => 'path starting with /admin',
                        'query' => 'optional query parameters',
                        'mode' => 'navigation|shortcut',
                    ],
                    'action' => [
                        'name' => 'matches managementActions.name',
                        'summary' => 'human summary',
                        'api' => [
                            'method' => 'HTTP verb',
                            'path' => 'full API path beginning with /api/v1',
                            'payload' => 'JSON payload ready for execution',
                        ],
                        'autoExecute' => 'boolean default false',
                    ],
                    'missing' => [
                        [
                            'field' => 'record_ids',
                            'description' => 'explain what is needed',
                        ],
                    ],
                ],
                'alternatives' => 'optional array of additional intents following the same shape',
            ],
        ];

        $capabilityJson = json_encode($capabilities, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

        return <<<PROMPT
You are CarbonTrack's admin AI command planner. Convert administrator natural language into precise instructions.

Rules:
- Only use navigation targets, quick actions, and management actions exactly as defined.
- Prefer navigation or quick actions when the user wants to open a page or UI workflow.
- For management actions, fill payload fields using provided context. If required parameters are missing, leave them empty and describe the missing information.
- Do not invent endpoints or parameters outside the provided list.
- Always respond with a single JSON object matching the responseSchema.
- Use Chinese labels if the user query is Chinese, otherwise keep English.
- Keep reasoning short.

Capabilities:
{$capabilityJson}
PROMPT;
    }

    /**
     * @param array<string,mixed> $decoded
     * @param array<string,mixed> $rawResponse
     * @return array<string,mixed>
     */
    private function normalizeResult(array $decoded, array $rawResponse): array
    {
        $intent = $decoded['intent'] ?? null;
        if (!is_array($intent)) {
            return $this->fallbackIntent($decoded['query'] ?? '');
        }

        $primary = $this->normalizeIntent($intent);

        $alternatives = [];
        if (!empty($decoded['alternatives']) && is_array($decoded['alternatives'])) {
            foreach ($decoded['alternatives'] as $candidate) {
                if (!is_array($candidate)) {
                    continue;
                }
                $alternatives[] = $this->normalizeIntent($candidate);
            }
        }

        return [
            'intent' => $primary,
            'alternatives' => $alternatives,
            'metadata' => [
                'model' => $rawResponse['model'] ?? $this->model,
                'usage' => $rawResponse['usage'] ?? null,
                'finish_reason' => $rawResponse['choices'][0]['finish_reason'] ?? null,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $intent
     * @return array<string,mixed>
     */
    private function normalizeIntent(array $intent): array
    {
        $type = is_string($intent['type'] ?? null) ? strtolower((string)$intent['type']) : 'fallback';
        $confidence = $this->normalizeConfidence($intent['confidence'] ?? null);
        $label = is_string($intent['label'] ?? null) ? trim($intent['label']) : 'AI suggestion';
        $reasoning = is_string($intent['reasoning'] ?? null) ? trim($intent['reasoning']) : null;

        $normalized = [
            'type' => $type,
            'label' => $label,
            'confidence' => $confidence,
            'reasoning' => $reasoning,
            'missing' => [],
        ];

        if ($type === 'navigate' || $type === 'quick_action') {
            $normalized = array_merge($normalized, $this->normalizeNavigationIntent($intent, $type));
        } elseif ($type === 'action') {
            $normalized = array_merge($normalized, $this->normalizeActionIntent($intent));
        } else {
            $normalized['type'] = 'fallback';
            $normalized['reasoning'] = $reasoning ?? 'Unable to confidently map the instruction to a known command.';
        }

        return $normalized;
    }

    /**
     * @param array<string,mixed> $intent
     * @return array<string,mixed>
     */
    private function normalizeNavigationIntent(array $intent, string $type): array
    {
        $target = $intent['target'] ?? [];
        $routeId = is_string($target['routeId'] ?? null) ? $target['routeId'] : null;

        if ($routeId && isset(self::NAVIGATION_TARGETS[$routeId])) {
            $definition = self::NAVIGATION_TARGETS[$routeId];
            $mode = 'navigation';
        } elseif ($routeId && isset(self::QUICK_ACTIONS[$routeId])) {
            $definition = self::QUICK_ACTIONS[$routeId];
            $mode = $definition['mode'] ?? 'shortcut';
        } else {
            $definition = null;
            $mode = 'navigation';
        }

        if ($definition === null) {
            // try fallback by route match
            $route = is_string($target['route'] ?? null) ? $target['route'] : null;
            if ($route) {
                foreach (self::NAVIGATION_TARGETS as $nav) {
                    if ($nav['route'] === $route) {
                        $definition = $nav;
                        $routeId = $nav['id'];
                        break;
                    }
                }
                if (!$definition) {
                    foreach (self::QUICK_ACTIONS as $quick) {
                        if ($quick['route'] === $route) {
                            $definition = $quick;
                            $routeId = $quick['id'];
                            $mode = $quick['mode'] ?? 'shortcut';
                            break;
                        }
                    }
                }
            }
        }

        if ($definition === null) {
            return [
                'type' => 'fallback',
                'reasoning' => 'Target route is not part of the allowed navigation set.',
                'target' => null,
                'missing' => [],
            ];
        }

        $query = [];
        if (isset($target['query']) && is_array($target['query'])) {
            foreach ($target['query'] as $key => $value) {
                if (is_scalar($value)) {
                    $query[(string)$key] = (string)$value;
                }
            }
        } elseif (isset($definition['query']) && is_array($definition['query'])) {
            $query = $definition['query'];
        }

        return [
            'target' => [
                'routeId' => $routeId ?? $definition['id'],
                'route' => $definition['route'],
                'mode' => $mode,
                'query' => $query,
            ],
            'missing' => [],
        ];
    }

    /**
     * @param array<string,mixed> $intent
     * @return array<string,mixed>
     */
    private function normalizeActionIntent(array $intent): array
    {
        $action = $intent['action'] ?? [];
        $name = is_string($action['name'] ?? null) ? $action['name'] : null;
        if (!$name || !isset(self::ACTION_DEFINITIONS[$name])) {
            return [
                'type' => 'fallback',
                'reasoning' => 'Requested action is not available.',
                'action' => null,
                'missing' => [],
            ];
        }

        $definition = self::ACTION_DEFINITIONS[$name];

        $api = $action['api'] ?? [];
        $payload = $api['payload'] ?? null;
        if (!is_array($payload)) {
            $payload = [];
        }

        $payload = $this->mergePayloadTemplate($definition['api']['payloadTemplate'], $payload);

        $missing = $this->resolveMissingRequirements($definition['requires'], $payload);

        $summary = is_string($action['summary'] ?? null)
            ? trim($action['summary'])
            : $definition['label'];

        $autoExecute = isset($action['autoExecute'])
            ? (bool)$action['autoExecute']
            : (bool)($definition['autoExecute'] ?? false);

        return [
            'action' => [
                'name' => $definition['name'],
                'summary' => $summary,
                'api' => [
                    'method' => $definition['api']['method'],
                    'path' => $definition['api']['path'],
                    'payload' => $payload,
                ],
                'autoExecute' => $autoExecute,
                'requires' => $definition['requires'],
            ],
            'missing' => $missing,
        ];
    }

    /**
     * @param array<string,mixed> $template
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function mergePayloadTemplate(array $template, array $payload): array
    {
        $result = $template;
        foreach ($payload as $key => $value) {
            $result[$key] = $value;
        }

        return $result;
    }

    /**
     * @param array<int,string> $requirements
     * @param array<string,mixed> $payload
     * @return array<int,array{field:string,description:string}>
     */
    private function resolveMissingRequirements(array $requirements, array $payload): array
    {
        $missing = [];
        foreach ($requirements as $field) {
            $value = $payload[$field] ?? null;
            $isMissing = false;
            if (is_array($value)) {
                $isMissing = count(array_filter($value, fn ($item) => $item !== null && $item !== '')) === 0;
            } else {
                $isMissing = $value === null || $value === '' || $value === [];
            }

            if ($isMissing) {
                $missing[] = [
                    'field' => $field,
                    'description' => sprintf('Provide a value for %s.', $field),
                ];
            }
        }

        return $missing;
    }

    private function normalizeConfidence(mixed $value): float
    {
        if (!is_numeric($value)) {
            return 0.5;
        }

        $confidence = (float)$value;
        if ($confidence < 0) {
            return 0.0;
        }

        if ($confidence > 1) {
            return 1.0;
        }

        return round($confidence, 2);
    }

    /**
     * @return array<string,mixed>
     */
    private function fallbackIntent(string $query): array
    {
        return [
            'intent' => [
                'type' => 'fallback',
                'label' => '未能理解的指令',
                'confidence' => 0.0,
                'reasoning' => '无法从输入中提取明确的管理指令，请改用关键字搜索或再具体一些。',
                'missing' => [],
            ],
            'alternatives' => [],
            'metadata' => [
                'model' => $this->model,
                'usage' => null,
                'finish_reason' => 'fallback',
            ],
        ];
    }

    private string $model;
    private float $temperature;
    private int $maxTokens;
    private bool $enabled;
}

