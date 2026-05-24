package expo.modules.carbontrackpow

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class CarbonTrackPowModule : Module() {
  private val cancellations = ConcurrentHashMap<String, AtomicBoolean>()

  override fun definition() = ModuleDefinition {
    Name("CarbonTrackPow")

    AsyncFunction("solve") {
      challenge: String,
      difficulty: Int,
      maxAttempts: Int,
      timeoutMs: Int,
      operationId: String ->
      solve(challenge, difficulty, maxAttempts, timeoutMs, operationId)
    }

    Function("cancel") { operationId: String ->
      cancellations.computeIfAbsent(operationId) { AtomicBoolean(false) }.set(true)
    }
  }

  private fun solve(
    challenge: String,
    difficulty: Int,
    maxAttempts: Int,
    timeoutMs: Int,
    operationId: String
  ): Map<String, Any> {
    if (challenge.isBlank() || difficulty < 1 || maxAttempts < 1 || timeoutMs < 1 || operationId.isBlank()) {
      throw IllegalArgumentException("Invalid proof-of-work challenge")
    }

    val cancelled = cancellations.computeIfAbsent(operationId) { AtomicBoolean(false) }
    val startedAt = System.currentTimeMillis()
    val prefix = "$challenge:".toByteArray(StandardCharsets.UTF_8)
    val digest = MessageDigest.getInstance("SHA-256")
    val nonceBuffer = ByteArray(maxAttempts.toString().length)

    try {
      for (nonce in 0 until maxAttempts) {
        if ((nonce and 0x3ff) == 0) {
          if (cancelled.get()) {
            throw IllegalStateException("Proof-of-work calculation cancelled")
          }
          if (System.currentTimeMillis() - startedAt > timeoutMs) {
            throw IllegalStateException("Proof-of-work calculation timed out")
          }
        }

        digest.reset()
        digest.update(prefix)
        val nonceLength = writeDecimalBytes(nonce, nonceBuffer)
        digest.update(nonceBuffer, 0, nonceLength)
        val hash = digest.digest()
        if (hasLeadingZeroBits(hash, difficulty)) {
          return mapOf(
            "nonce" to nonce.toString(),
            "attempts" to nonce + 1,
            "elapsedMs" to (System.currentTimeMillis() - startedAt)
          )
        }
      }

      throw IllegalStateException("Proof-of-work attempt limit exceeded")
    } finally {
      cancellations.remove(operationId)
    }
  }

  private fun writeDecimalBytes(value: Int, buffer: ByteArray): Int {
    if (value == 0) {
      buffer[0] = '0'.code.toByte()
      return 1
    }

    var divisor = 1
    while (value / divisor >= 10) {
      divisor *= 10
    }

    var remaining = value
    var length = 0
    while (divisor > 0) {
      val digit = remaining / divisor
      buffer[length] = ('0'.code + digit).toByte()
      length += 1
      remaining %= divisor
      divisor /= 10
    }

    return length
  }

  private fun hasLeadingZeroBits(bytes: ByteArray, difficulty: Int): Boolean {
    val fullBytes = difficulty / 8
    for (index in 0 until fullBytes) {
      if ((bytes[index].toInt() and 0xff) != 0) {
        return false
      }
    }

    val remainingBits = difficulty % 8
    if (remainingBits == 0) {
      return true
    }

    val mask = (0xff shl (8 - remainingBits)) and 0xff
    return ((bytes[fullBytes].toInt() and 0xff) and mask) == 0
  }
}
