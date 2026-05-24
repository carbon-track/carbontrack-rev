import ExpoModulesCore
import CryptoKit
import Foundation

public class CarbonTrackPowModule: Module {
  private let lock = NSLock()
  private var cancellations: [String: Bool] = [:]

  public func definition() -> ModuleDefinition {
    Name("CarbonTrackPow")

    AsyncFunction("solve") { (
      challenge: String,
      difficulty: Int,
      maxAttempts: Int,
      timeoutMs: Int,
      operationId: String
    ) -> [String: Any] in
      return try self.solve(
        challenge: challenge,
        difficulty: difficulty,
        maxAttempts: maxAttempts,
        timeoutMs: timeoutMs,
        operationId: operationId
      )
    }

    Function("cancel") { (operationId: String) in
      self.cancel(operationId: operationId)
    }
  }

  private func solve(
    challenge: String,
    difficulty: Int,
    maxAttempts: Int,
    timeoutMs: Int,
    operationId: String
  ) throws -> [String: Any] {
    if challenge.isEmpty || difficulty < 1 || maxAttempts < 1 || timeoutMs < 1 || operationId.isEmpty {
      throw NSError(domain: "CarbonTrackPow", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Invalid proof-of-work challenge"
      ])
    }

    beginCancellation(operationId: operationId)
    let startedAt = DispatchTime.now().uptimeNanoseconds
    let timeoutNanos = UInt64(timeoutMs) * 1_000_000
    let prefix = Data("\(challenge):".utf8)

    defer {
      removeCancellation(operationId: operationId)
    }

    for nonce in 0..<maxAttempts {
      if (nonce & 0x3ff) == 0 {
        if isCancelled(operationId: operationId) {
          throw NSError(domain: "CarbonTrackPow", code: 2, userInfo: [
            NSLocalizedDescriptionKey: "Proof-of-work calculation cancelled"
          ])
        }

        let elapsedNanos = DispatchTime.now().uptimeNanoseconds - startedAt
        if elapsedNanos > timeoutNanos {
          throw NSError(domain: "CarbonTrackPow", code: 3, userInfo: [
            NSLocalizedDescriptionKey: "Proof-of-work calculation timed out"
          ])
        }
      }

      var message = Data()
      message.append(prefix)
      message.append(Data(String(nonce).utf8))
      let hash = SHA256.hash(data: message)
      if hasLeadingZeroBits(hash, difficulty: difficulty) {
        let elapsedMs = Int((DispatchTime.now().uptimeNanoseconds - startedAt) / 1_000_000)
        return [
          "nonce": String(nonce),
          "attempts": nonce + 1,
          "elapsedMs": elapsedMs
        ]
      }
    }

    throw NSError(domain: "CarbonTrackPow", code: 4, userInfo: [
      NSLocalizedDescriptionKey: "Proof-of-work attempt limit exceeded"
    ])
  }

  private func hasLeadingZeroBits<D: Sequence>(_ digest: D, difficulty: Int) -> Bool where D.Element == UInt8 {
    let bytes = Array(digest)
    let fullBytes = difficulty / 8
    for index in 0..<fullBytes {
      if bytes[index] != 0 {
        return false
      }
    }

    let remainingBits = difficulty % 8
    if remainingBits == 0 {
      return true
    }

    let mask = UInt8((0xff << (8 - remainingBits)) & 0xff)
    return (bytes[fullBytes] & mask) == 0
  }

  private func setCancelled(_ cancelled: Bool, operationId: String) {
    lock.lock()
    cancellations[operationId] = cancelled
    lock.unlock()
  }

  private func beginCancellation(operationId: String) {
    lock.lock()
    if cancellations[operationId] == nil {
      cancellations[operationId] = false
    }
    lock.unlock()
  }

  private func cancel(operationId: String) {
    setCancelled(true, operationId: operationId)
  }

  private func isCancelled(operationId: String) -> Bool {
    lock.lock()
    let cancelled = cancellations[operationId] ?? false
    lock.unlock()
    return cancelled
  }

  private func removeCancellation(operationId: String) {
    lock.lock()
    cancellations.removeValue(forKey: operationId)
    lock.unlock()
  }
}
