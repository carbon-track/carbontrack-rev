<?php

declare(strict_types=1);

namespace CarbonTrack\Support;

use Psr\Http\Message\ServerRequestInterface;

final class CorsHeaderBuilder
{
    public static function forRequest(ServerRequestInterface $request): array
    {
        $allowedOriginsEnv = $_ENV['CORS_ALLOWED_ORIGINS'] ?? '*';
        $allowedMethods = $_ENV['CORS_ALLOWED_METHODS'] ?? 'GET,POST,PUT,DELETE,OPTIONS';
        $allowedHeadersDefault = $_ENV['CORS_ALLOWED_HEADERS'] ?? 'Content-Type,Authorization,X-Request-ID,X-Requested-With,X-Turnstile-Token';
        $exposeHeaders = $_ENV['CORS_EXPOSE_HEADERS'] ?? 'Content-Type,Authorization,X-Request-ID';
        $allowCredentials = filter_var($_ENV['CORS_ALLOW_CREDENTIALS'] ?? 'true', FILTER_VALIDATE_BOOLEAN);

        $allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $allowedOriginsEnv))));
        if (($_ENV['APP_ENV'] ?? 'production') !== 'production') {
            $allowedOrigins = array_values(array_unique(array_merge($allowedOrigins, [
                'http://localhost:5173',
                'http://localhost:3000',
                'http://127.0.0.1:5173',
                'http://127.0.0.1:3000',
            ])));
        }

        $origin = $request->getHeaderLine('Origin');
        $varyValues = ['Origin'];
        $headers = [
            'Access-Control-Allow-Methods' => $allowedMethods,
            'Access-Control-Expose-Headers' => $exposeHeaders,
            'Access-Control-Max-Age' => '86400',
            'X-CORS-Middleware' => 'active',
        ];

        $requestHeaders = $request->getHeaderLine('Access-Control-Request-Headers');
        if ($requestHeaders !== '') {
            $headers['Access-Control-Allow-Headers'] = $requestHeaders;
            $varyValues[] = 'Access-Control-Request-Headers';
        } else {
            $headers['Access-Control-Allow-Headers'] = $allowedHeadersDefault;
        }

        if (self::isOriginAllowed($origin, $allowedOrigins)) {
            $headers['Access-Control-Allow-Origin'] = $origin;
            if ($allowCredentials) {
                $headers['Access-Control-Allow-Credentials'] = 'true';
            }
        } elseif (in_array('*', $allowedOrigins, true) && !$allowCredentials) {
            $headers['Access-Control-Allow-Origin'] = '*';
        }

        $headers['Vary'] = implode(', ', array_unique($varyValues));

        return array_filter($headers, static fn ($value): bool => $value !== null && $value !== '');
    }

    private static function isOriginAllowed(?string $origin, array $allowedOrigins): bool
    {
        if (!$origin) {
            return false;
        }

        if ($origin === 'null') {
            foreach ($allowedOrigins as $allowed) {
                if ($allowed === '*' || strcasecmp($allowed, 'null') === 0) {
                    return true;
                }
            }
            return false;
        }

        foreach ($allowedOrigins as $allowed) {
            if ($allowed === '*' || strcasecmp($allowed, $origin) === 0) {
                return true;
            }

            if (strpos($allowed, '*.') !== false) {
                $wildcardPlaceholder = '__CORS_SUBDOMAIN_WILDCARD__';
                $quotedAllowed = preg_quote(str_replace('*.', $wildcardPlaceholder, $allowed), '/');
                $pattern = '/^' . str_replace(preg_quote($wildcardPlaceholder, '/'), '[^.]+\\.', $quotedAllowed) . '$/i';
                if (preg_match($pattern, $origin)) {
                    return true;
                }
            }
        }

        return false;
    }
}
