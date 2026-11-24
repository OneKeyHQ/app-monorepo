import ActivityKit
import React
import UIKit

@MainActor
private final class SwapLiveActivityManager {
  private struct PushBinding {
    var token: Data
    var inFlightToken: Data?
    var failedAttempts = 0
    var registered = false
  }

  static let shared = SwapLiveActivityManager()
  private let defaults = UserDefaults.standard
  private let attemptedKey = "onekey.swapLiveActivity.attempted.v1"
  private var observers: [String: Task<Void, Never>] = [:]
  private var presentationTasks: [String: Task<Void, Never>] = [:]
  private let pushRetryDelays: [UInt64] = [1, 2, 4, 8]
  private var pushTokenObservers: [String: Task<Void, Never>] = [:]
  private var pushBindings: [String: PushBinding] = [:]
  private var pushRetries: [String: Task<Void, Never>] = [:]
  private var pushSequence = 0
  private var mutationTasks: [String: Task<Void, Never>] = [:]
  private var acceptedRevisions: [String: Int64] = [:]
  private var acceptedStates: [String: SwapLiveActivityAttributes.ContentState] = [:]
  private var presentationGenerations: [String: Int] = [:]

  private init() {
    for activity in activities {
      observe(activity)
      schedulePresentation(activity)
    }
    Task { [weak self] in
      for await _ in NotificationCenter.default.notifications(named: UIApplication.didBecomeActiveNotification) {
        self?.retryFailedPushBindings()
      }
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
      staleDate: state.status.isTerminal ? nil : state.updatedAtMs.map {
        Date(timeIntervalSince1970: $0 / 1000 + 120)
      },
      relevanceScore: order.startedAtMs / 10_000_000_000_000
    )
  }

  private func currentState(_ activity: Activity<SwapLiveActivityAttributes>) -> SwapLiveActivityAttributes.ContentState {
    let native = activity.content.state
    if activity.attributes.order.usesRemoteUpdates { return native }
    if let accepted = acceptedStates[activity.id], (accepted.revision ?? 0) >= (native.revision ?? 0) {
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
    let fromNativeBitcoin = order.fromToken.networkId == "btc--0" && order.fromToken.isNative == true
    let toNativeBitcoin = order.toToken.networkId == "btc--0" && order.toToken.isNative == true
    let hasNativeBitcoin = order.usesRemoteUpdates
      ? (fromNativeBitcoin || toNativeBitcoin) &&
        !order.networkId.isEmpty && order.networkId == order.fromToken.networkId
      : (order.networkId == "btc--0" && order.fromToken.isNative != false) || toNativeBitcoin
    guard order.schemaVersion == 1, hasNativeBitcoin,
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
      pushType: order.usesRemoteUpdates ? .token : nil
    )
    attempted[order.orderKey] = order.expiresAtMs
    defaults.set(attempted, forKey: attemptedKey)
    if !order.usesRemoteUpdates { acceptedStates[activity.id] = state }
    observe(activity)
    schedulePresentation(activity, status: state.status)
  }

  func update(_ request: SwapLiveActivityRequest) async {
    guard let activity = activities.first(where: {
      $0.attributes.order.orderKey == request.order.orderKey
    }), !activity.attributes.order.usesRemoteUpdates else { return }
    await mutate(activity) {
      let previous = self.currentState(activity)
      guard request.content.revision > max(previous.revision ?? 0, self.acceptedRevisions[activity.id] ?? 0),
            previous.status.canAdvance(to: request.content.status) else { return }
      self.acceptedRevisions[activity.id] = request.content.revision
      let statusChanged = previous.status != request.content.status
      let order = activity.attributes.order
      var next = SwapLiveActivityAttributes.ContentState.make(
        order: order, status: request.content.status,
        revision: request.content.revision, updatedAtMs: request.content.updatedAtMs,
        displayPhase: statusChanged ? "eta" : (previous.displayPhase ?? "eta"),
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
      guard needsPresentation || request.content.updatedAtMs >= (activity.content.state.updatedAtMs ?? 0) + 60_000 else { return }
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
    }), !activity.attributes.order.usesRemoteUpdates else { return }
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
      stopPushBinding(activity.id)
      await mutate(activity) {
        let finalContent = activity.attributes.order.usesRemoteUpdates
          ? nil : self.content(self.currentState(activity), order: activity.attributes.order)
        await activity.end(finalContent, dismissalPolicy: .immediate)
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
          self.stopPushBinding(activity.id)
          self.observers.removeValue(forKey: activity.id)
          self.mutationTasks.removeValue(forKey: activity.id)
          self.acceptedRevisions.removeValue(forKey: activity.id)
          self.acceptedStates.removeValue(forKey: activity.id)
          self.presentationGenerations.removeValue(forKey: activity.id)
          return
        }
      }
    }
    guard activity.attributes.order.usesRemoteUpdates, activity.id.utf8.count <= 64 else { return }
    pushTokenObservers[activity.id] = Task { [weak self] in
      let updates = activity.pushTokenUpdates
      if let token = activity.pushToken { self?.acceptPushToken(token, for: activity.id) }
      for await token in updates {
        guard let self, !Task.isCancelled else { return }
        self.acceptPushToken(token, for: activity.id)
      }
    }
  }

  private func acceptPushToken(_ token: Data, for activityId: String) {
    guard pushTokenObservers[activityId] != nil, !token.isEmpty else { return }
    let previous = pushBindings[activityId]
    guard previous?.token != token else { return }
    pushBindings[activityId] = PushBinding(token: token, inFlightToken: previous?.inFlightToken)
    pushRetries.removeValue(forKey: activityId)?.cancel()
    registerPushBinding(activityId)
  }

  private func registerPushBinding(_ activityId: String) {
    guard var binding = pushBindings[activityId], binding.inFlightToken == nil,
          !binding.registered, pushRetries[activityId] == nil else { return }
    binding.inFlightToken = binding.token
    pushBindings[activityId] = binding
    JPUSHService.registerLiveActivity(activityId, pushToken: binding.token, completion: { [weak self] code, _, _, _ in
      Task { @MainActor in self?.completePushBinding(activityId, code: code) }
    }, seq: nextPushSequence())
  }

  private func completePushBinding(_ activityId: String, code: Int) {
    guard var binding = pushBindings[activityId] else {
      // An acknowledged registration can arrive after the activity was closed.
      if code == 0 { unregisterPush(activityId) }
      return
    }
    let tokenChanged = binding.inFlightToken != binding.token
    binding.inFlightToken = nil
    if tokenChanged {
      pushBindings[activityId] = binding
      registerPushBinding(activityId)
      return
    }
    if code == 0 {
      binding.registered = true
      pushBindings[activityId] = binding
      return
    }
    binding.failedAttempts += 1
    pushBindings[activityId] = binding
    guard binding.failedAttempts <= pushRetryDelays.count else { return }
    let delay = pushRetryDelays[binding.failedAttempts - 1]
    pushRetries[activityId] = Task { [weak self] in
      try? await Task.sleep(nanoseconds: delay * 1_000_000_000)
      guard let self, !Task.isCancelled else { return }
      self.pushRetries.removeValue(forKey: activityId)
      self.registerPushBinding(activityId)
    }
  }

  private func retryFailedPushBindings() {
    for (activityId, var binding) in pushBindings where binding.failedAttempts > pushRetryDelays.count {
      binding.failedAttempts = 0
      pushBindings[activityId] = binding
      registerPushBinding(activityId)
    }
  }

  private func stopPushBinding(_ activityId: String) {
    guard let observer = pushTokenObservers.removeValue(forKey: activityId) else { return }
    observer.cancel()
    pushRetries.removeValue(forKey: activityId)?.cancel()
    pushBindings.removeValue(forKey: activityId)
    unregisterPush(activityId)
  }

  private func unregisterPush(_ activityId: String) {
    JPUSHService.registerLiveActivity(activityId, pushToken: nil, completion: nil, seq: nextPushSequence())
  }

  private func nextPushSequence() -> Int {
    pushSequence &+= 1
    return pushSequence
  }

  private func pushRegistration(_ activity: Activity<SwapLiveActivityAttributes>) -> String {
    guard activity.attributes.order.usesRemoteUpdates else { return "notRequested" }
    guard activity.id.utf8.count <= 64 else { return "failed" }
    guard let binding = pushBindings[activity.id] else { return "pending" }
    if binding.registered { return "registered" }
    return binding.failedAttempts > pushRetryDelays.count ? "failed" : "pending"
  }

  private func schedulePresentation(_ activity: Activity<SwapLiveActivityAttributes>, status: SwapLiveActivityStatus? = nil) {
    guard !activity.attributes.order.usesRemoteUpdates else { return }
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
        "pushRegistration": pushRegistration(activity),
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
