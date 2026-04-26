<?php

declare(strict_types=1);

namespace CarbonTrack\Middleware;

use CarbonTrack\Support\CorsHeaderBuilder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class CorsMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $method = strtoupper($request->getMethod());
        $headersToSet = CorsHeaderBuilder::forRequest($request);

        if ($method === 'OPTIONS') {
            $preflight = new \Slim\Psr7\Response(204);
            foreach ($headersToSet as $name => $value) {
                if ($value !== null && $value !== '') {
                    $preflight = $preflight->withHeader($name, $value);
                }
            }

            $reqMethod = $request->getHeaderLine('Access-Control-Request-Method');
            if ($reqMethod) {
                $preflight = $preflight->withHeader('Access-Control-Allow-Methods', $reqMethod);
                $preflight = $preflight->withAddedHeader('Vary', 'Access-Control-Request-Method');
            }

            return $preflight;
        }

        $response = $handler->handle($request);
        foreach ($headersToSet as $name => $value) {
            if ($value !== null && $value !== '') {
                $response = $response->withHeader($name, $value);
            }
        }

        return $response;
    }
}
