import ActivityKit
import React
import UIKit

@MainActor
private final class SwapLiveActivityManager {
  static let shared = SwapLiveActivityManager()
  private let defaults = UserDefaults.standard
  private let attemptedKey = "onekey.swapLiveActivity.attempted.v1"
  private var observers: [String: Task<Void, Never>] = [:]
  private var presentationTasks: [String: Task<Void, Never>] = [:]
  private var pushStates: [String: String] = [:]
  private var mutationTasks: [String: Task<Void, Never>] = [:]
  private var acceptedRevisions: [String: Int64] = [:]
  private var acceptedStates: [String: SwapLiveActivityAttributes.ContentState] = [:]
  private var presentationGenerations: [String: Int] = [:]

  private init() {
    for activity in Activity<SwapLiveActivityAttributes>.activities {
      observe(activity)
      schedulePresentation(activity)
    }
  }

  private var activities: [Activity<SwapLiveActivityAttributes>] {
    Activity<SwapLiveActivityAttributes>.activities.filter {
      $0.activityState == .active || $0.activityState == .stale
    }
  }

  private func content(
    _ state: SwapLiveActivityAttributes.ContentState,
    order: SwapLiveActivityOrder
  ) -> ActivityContent<SwapLiveActivityAttributes.ContentState> {
    ActivityContent(
      state: state,
      staleDate: state.status.isTerminal ? nil : Date(timeIntervalSince1970: state.updatedAtMs / 1000 + 120),
      relevanceScore: order.startedAtMs / 10_000_000_000_000
    )
  }

  private func currentState(_ activity: Activity<SwapLiveActivityAttributes>) -> SwapLiveActivityAttributes.ContentState {
    let native = activity.content.state
    if let accepted = acceptedStates[activity.id], accepted.revision >= native.revision {
      return accepted
    }
    acceptedStates[activity.id] = native
    return native
  }

  private func publish(
    _ state: SwapLiveActivityAttributes.ContentState,
    to activity: Activity<SwapLiveActivityAttributes>,
    alert: AlertConfiguration? = nil
  ) async {
    acceptedStates[activity.id] = state
    await activity.update(content(state, order: activity.attributes.order), alertConfiguration: alert)
  }

  func start(_ request: SwapLiveActivityRequest) throws {
    let order = request.order
    guard order.schemaVersion == 1, order.networkId == "btc--0",
          !order.orderKey.isEmpty, order.orderKey.count <= 256,
          order.estimatedEndAtMs > order.startedAtMs,
          order.expiresAt > Date(), !request.content.status.isTerminal else { return }
    guard !activities.contains(where: { $0.attributes.order.orderKey == order.orderKey }) else { return }
    var attempted = defaults.dictionary(forKey: attemptedKey) as? [String: Double] ?? [:]
    attempted = attempted.filter { $0.value > Date().timeIntervalSince1970 * 1000 }
    guard attempted[order.orderKey] == nil else { return }
    guard UIApplication.shared.applicationState == .active,
          ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    let attributes = SwapLiveActivityAttributes(
      order: order,
      fromIconName: "",
      toIconName: ""
    )
    let state = SwapLiveActivityAttributes.ContentState.make(
      order: order, status: request.content.status,
      revision: request.content.revision, updatedAtMs: request.content.updatedAtMs,
      strings: request.content.strings
    )
    let activity = try Activity.request(
      attributes: attributes, content: content(state, order: order),
      pushType: nil
    )
    attempted[order.orderKey] = order.expiresAtMs
    defaults.set(attempted, forKey: attemptedKey)
    acceptedStates[activity.id] = state
    observe(activity)
    schedulePresentation(activity, status: state.status)
  }

  func update(_ request: SwapLiveActivityRequest) async {
    guard let activity = activities.first(where: {
      $0.attributes.order.orderKey == request.order.orderKey
    }) else { return }
    await mutate(activity) {
      let previous = self.currentState(activity)
      guard request.content.revision > max(previous.revision, self.acceptedRevisions[activity.id] ?? 0),
            previous.status.canAdvance(to: request.content.status) else { return }
      self.acceptedRevisions[activity.id] = request.content.revision
      let statusChanged = previous.status != request.content.status
      let order = activity.attributes.order
      var next = SwapLiveActivityAttributes.ContentState.make(
        order: order, status: request.content.status,
        revision: request.content.revision, updatedAtMs: request.content.updatedAtMs,
        displayPhase: statusChanged ? "eta" : previous.displayPhase,
        strings: request.content.strings ?? previous.strings
      )
      next.imageRevision = previous.imageRevision
      if next.status.isError {
        next.progressStoppedAtMs = previous.progressStoppedAtMs ?? next.progressStoppedAtMs
      }
      next.preserveTerminalDate(from: previous, now: Date())
      let needsPresentation = statusChanged || next.etaMinutes != previous.etaMinutes
        || next.almostDone != previous.almostDone || next.strings != previous.strings
      self.acceptedStates[activity.id] = next
      // A successful status query also refreshes freshness when the state is unchanged.
      guard needsPresentation || next.updatedAtMs >= activity.content.state.updatedAtMs + 60_000 else { return }
      let alert: AlertConfiguration? = statusChanged && (next.status.isTerminal || next.status == .failed || next.status == .refunding)
        ? AlertConfiguration(title: "OneKey Swap", body: self.alertText(next), sound: .default)
        : nil
      await self.publish(next, to: activity, alert: alert)
      if statusChanged { self.schedulePresentation(activity, status: next.status) }
    }
  }

  func updateStrings(_ request: SwapLiveActivityStringsRequest) async {
    guard let activity = activities.first(where: {
      $0.attributes.order.orderKey == request.orderKey
    }) else { return }
    await mutate(activity) {
      var state = self.currentState(activity)
      guard state.revision == request.revision, state.strings != request.strings else { return }
      state.strings = request.strings
      await self.publish(state, to: activity)
    }
  }

  // ActivityKit updates suspend, so MainActor alone does not serialize their writes.
  private func mutate(
    _ activity: Activity<SwapLiveActivityAttributes>,
    operation: @escaping @MainActor () async -> Void
  ) async {
    let previous = mutationTasks[activity.id]
    let task = Task { @MainActor in
      await previous?.value
      guard activity.activityState == .active || activity.activityState == .stale else { return }
      await operation()
    }
    mutationTasks[activity.id] = task
    await task.value
  }

  func end(_ orderKey: String) async {
    for activity in activities where activity.attributes.order.orderKey == orderKey {
      presentationTasks.removeValue(forKey: activity.id)?.cancel()
      unregisterPush(activity)
      await mutate(activity) {
        await activity.end(self.content(self.currentState(activity), order: activity.attributes.order), dismissalPolicy: .immediate)
      }
    }
  }

  func clearTracking() {
    defaults.removeObject(forKey: attemptedKey)
  }

  private func observe(_ activity: Activity<SwapLiveActivityAttributes>) {
    guard observers[activity.id] == nil else { return }
    observers[activity.id] = Task { [weak self] in
      for await state in activity.activityStateUpdates {
        guard let self else { return }
        if state == .dismissed || state == .ended {
          self.presentationTasks.removeValue(forKey: activity.id)?.cancel()
          self.unregisterPush(activity)
          self.observers.removeValue(forKey: activity.id)
          self.mutationTasks.removeValue(forKey: activity.id)
          self.pushStates.removeValue(forKey: activity.id)
          self.acceptedRevisions.removeValue(forKey: activity.id)
          self.acceptedStates.removeValue(forKey: activity.id)
          self.presentationGenerations.removeValue(forKey: activity.id)
          return
        }
      }
    }
    // Remote updates require an authenticated server subscription and a single writer.
    // Remove bindings created by older builds until that handoff exists.
    unregisterPush(activity)
    pushStates[activity.id] = "notRequested"
  }

  private func unregisterPush(_ activity: Activity<SwapLiveActivityAttributes>) {
    if !activity.attributes.order.isMock {
      JPUSHService.registerLiveActivity(activity.id, pushToken: nil, completion: nil, seq: 0)
    }
  }

  private func schedulePresentation(_ activity: Activity<SwapLiveActivityAttributes>, status: SwapLiveActivityStatus? = nil) {
    presentationTasks.removeValue(forKey: activity.id)?.cancel()
    let initialStatus = status ?? currentState(activity).status
    let generation = (presentationGenerations[activity.id] ?? 0) + 1
    presentationGenerations[activity.id] = generation
    presentationTasks[activity.id] = Task { [weak self] in
      guard let self else { return }
      if initialStatus.isTerminal {
        let schedule = self.currentState(activity).terminalSchedule(now: Date())
        try? await Task.sleep(nanoseconds: UInt64(schedule.endDelay * 1_000_000_000))
        guard !Task.isCancelled else { return }
        await self.mutate(activity) {
          guard self.presentationGenerations[activity.id] == generation,
                self.currentState(activity).status.isTerminal else { return }
          let dismissalPolicy: ActivityUIDismissalPolicy = schedule.dismissalDate <= Date()
            ? .immediate : .after(schedule.dismissalDate)
          await activity.end(
            self.content(self.currentState(activity), order: activity.attributes.order),
            dismissalPolicy: dismissalPolicy
          )
        }
        return
      }
      // A failed order may later be reported as refunding. Keep it visible until
      // the provider contract identifies a final state or the activity expires.
      guard initialStatus != .failed else { return }
      // This is a local presentation update, never a substitute for server tracking.
      try? await Task.sleep(nanoseconds: 3_000_000_000)
      guard !Task.isCancelled,
            activity.activityState == .active || activity.activityState == .stale else { return }
      await self.mutate(activity) {
        var state = self.currentState(activity)
        guard self.presentationGenerations[activity.id] == generation,
              !state.status.isTerminal else { return }
        state.displayPhase = "ring"
        await self.publish(state, to: activity)
      }
      while !Task.isCancelled {
        let order = activity.attributes.order
        let remaining = order.estimatedEndAt.timeIntervalSinceNow
        guard remaining > 0, !self.currentState(activity).status.isTerminal,
              self.presentationGenerations[activity.id] == generation else { return }
        let nextMinute = remaining - max(0, ceil(remaining / 60) - 1) * 60
        let nextBoundary = remaining > 10 ? min(nextMinute, remaining - 10) : remaining
        try? await Task.sleep(nanoseconds: UInt64(max(0.1, nextBoundary) * 1_000_000_000))
        guard !Task.isCancelled else { return }
        await self.mutate(activity) {
          var state = self.currentState(activity)
          guard self.presentationGenerations[activity.id] == generation,
                !state.status.isTerminal else { return }
          state.etaMinutes = Int(ceil(max(0, order.estimatedEndAt.timeIntervalSinceNow) / 60))
          state.almostDone = order.estimatedEndAt.timeIntervalSinceNow < 10
          await self.publish(state, to: activity)
        }
      }
    }
  }

  private func alertText(_ state: SwapLiveActivityAttributes.ContentState) -> LocalizedStringResource {
    let text: String
    switch state.status {
    case .done: text = state.strings?.done ?? "Swap completed"
    case .refunding: text = state.strings?.refunding ?? "Swap failed · Refund initiated"
    case .refunded: text = state.strings?.refunded ?? "Refunded"
    case .canceled: text = state.strings?.canceled ?? "Order canceled"
    default: text = state.strings?.swapFailed ?? "Swap failed"
    }
    return LocalizedStringResource(stringLiteral: text)
  }

  func snapshot() -> [String: Any] {
    let items: [[String: Any]] = activities.compactMap { activity in
      guard let orderData = try? JSONEncoder().encode(activity.attributes.order),
            let order = try? JSONSerialization.jsonObject(with: orderData),
            let contentData = try? JSONEncoder().encode(currentState(activity)),
            let state = try? JSONSerialization.jsonObject(with: contentData) else { return nil }
      return [
        "activityId": activity.id,
        "activityState": String(describing: activity.activityState),
        "order": order,
        "content": state,
        "pushRegistration": pushStates[activity.id] ?? "pending",
      ]
    }
    return ["supported": true, "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
            "activities": items]
  }
}

@objc(SwapLiveActivity)
final class SwapLiveActivityModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  private func decode(_ value: NSDictionary) throws -> SwapLiveActivityRequest {
    try JSONDecoder().decode(
      SwapLiveActivityRequest.self,
      from: JSONSerialization.data(withJSONObject: value)
    )
  }

  private func run(
    _ resolve: @escaping RCTPromiseResolveBlock,
    _ reject: @escaping RCTPromiseRejectBlock,
    operation: @escaping @MainActor () async throws -> Void
  ) {
    Task { @MainActor in
      do {
        try await operation()
        resolve(SwapLiveActivityManager.shared.snapshot())
      } catch {
        reject("LIVE_ACTIVITY_FAILED", error.localizedDescription, error)
      }
    }
  }

  @objc(getStatus:rejecter:)
  func getStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    run(resolve, reject) {}
  }

  @objc(start:resolver:rejecter:)
  func start(_ value: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {
    run(resolve, reject) { try SwapLiveActivityManager.shared.start(self.decode(value)) }
  }

  @objc(update:resolver:rejecter:)
  func update(_ value: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    run(resolve, reject) { await SwapLiveActivityManager.shared.update(try self.decode(value)) }
  }

  @objc(updateStrings:resolver:rejecter:)
  func updateStrings(_ value: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    run(resolve, reject) {
      let request = try JSONDecoder().decode(
        SwapLiveActivityStringsRequest.self,
        from: JSONSerialization.data(withJSONObject: value)
      )
      await SwapLiveActivityManager.shared.updateStrings(request)
    }
  }

  @objc(end:resolver:rejecter:)
  func end(_ orderKey: String, resolver resolve: @escaping RCTPromiseResolveBlock,
           rejecter reject: @escaping RCTPromiseRejectBlock) {
    run(resolve, reject) { await SwapLiveActivityManager.shared.end(orderKey) }
  }

  @objc(clearTracking:rejecter:)
  func clearTracking(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    run(resolve, reject) { SwapLiveActivityManager.shared.clearTracking() }
  }
}
