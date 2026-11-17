<?php

class ExceptionLoggingRuleFixture
{
    public function rejectsUnloggedSibling($response)
    {
        try {
            runTask();
        // ruleid: enforce-errorlogservice-in-catch
        } catch (\InvalidArgumentException $exception) { // nosemgrep: semgrep.enforce-errorlogservice-in-catch
            return $response->withStatus(422);
        // ruleid: enforce-errorlogservice-in-catch
        } catch (\RuntimeException $exception) {
            return $response->withStatus(500);
        }
    }

    public function rejectsGenericDebug($response, $diagnostics)
    {
        try {
            runTask();
        // ruleid: enforce-errorlogservice-in-catch
        } catch (\Throwable $exception) {
            $diagnostics->debug('Task failed');
            return $response->withStatus(500);
        }
    }

    public function rejectsServerErrorDespiteIgnoreName($response)
    {
        try {
            runTask();
        // ruleid: enforce-errorlogservice-in-catch
        } catch (\Throwable $ignore) {
            return $response->withStatus(500);
        }
    }

    public function rejectsConditionalRethrow($response, $rethrow)
    {
        try {
            runTask();
        // ruleid: enforce-errorlogservice-in-catch
        } catch (\Throwable $exception) {
            if ($rethrow) {
                throw $exception;
            }
            return $response->withStatus(500);
        }
    }

    public function rejectsUnexpectedJsonException($response)
    {
        try {
            runTask();
        // ruleid: enforce-errorlogservice-in-catch
        } catch (\JsonException $exception) {
            return $response->withStatus(500);
        }
    }

    public function allowsErrorLogService($response)
    {
        try {
            runTask();
        // ok: enforce-errorlogservice-in-catch
        } catch (\Throwable $exception) {
            $this->errorLogService->logException($exception);
            return $response->withStatus(500);
        }
    }

    public function allowsOptionalFallback()
    {
        try {
            return loadOptionalMetadata();
        // ok: enforce-errorlogservice-in-catch
        } catch (\Throwable $ignore) {
            return null;
        }
    }

    public function allowsOptionalFallbackWithIgnoredVariable()
    {
        try {
            return loadOptionalMetadata();
        // ok: enforce-errorlogservice-in-catch
        } catch (\Throwable $ignored) {
            return null;
        }
    }
}
