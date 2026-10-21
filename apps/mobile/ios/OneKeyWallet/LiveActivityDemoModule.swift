import ActivityKit
import React
import UIKit
internal import CryptoKit

@objc(LiveActivityDemo)
final class LiveActivityDemoModule: NSObject {
  private static let demoTitle = "OneKey Demo"
  private var isUpdating = false

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(getStatus:rejecter:)
  func getStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      resolve(snapshot())
    }
  }

  @objc(start:rejecter:)
  func start(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      await perform(resolve, reject) {
        guard UIApplication.shared.applicationState == .active else {
          throw demoError("Open the app before starting a Live Activity.")
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
          throw demoError("Live Activities are disabled in iOS Settings.")
        }
        guard activities.isEmpty else {
          throw demoError("End the existing demo before starting another one.")
        }
        _ = try Activity.request(
          attributes: LiveActivityAttributes(title: Self.demoTitle),
          content: ActivityContent(
            state: LiveActivityAttributes.ContentState(progress: 0),
            staleDate: nil
          ),
          pushType: nil
        )
      }
    }
  }

  @objc(update:resolver:rejecter:)
  func update(
    _ activityID: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      await perform(resolve, reject) {
        guard let activity = activities.first(where: { $0.id == activityID }) else {
          throw demoError("Demo no longer exists. Refresh its status.")
        }
        await activity.update(ActivityContent(
          state: LiveActivityAttributes.ContentState(
            progress: min(activity.content.state.progress + 25, 100)
          ),
          staleDate: nil
        ))
      }
    }
  }

  @objc(end:rejecter:)
  func end(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      await perform(resolve, reject) {
        for activity in activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }
  }

  @MainActor
  private var activities: [Activity<LiveActivityAttributes>] {
    Activity<LiveActivityAttributes>.activities.filter {
      $0.attributes.title == Self.demoTitle &&
        ($0.activityState == .active || $0.activityState == .stale)
    }
  }

  @MainActor
  private func snapshot() -> [String: Any] {
    [
      "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
      "activities": activities.map {
        [
          "id": $0.id,
          "state": String(describing: $0.activityState),
          "progress": $0.content.state.progress,
        ] as [String: Any]
      },
    ]
  }

  @MainActor
  private func perform(
    _ resolve: RCTPromiseResolveBlock,
    _ reject: RCTPromiseRejectBlock,
    operation: () async throws -> Void
  ) async {
    guard !isUpdating else {
      reject("LIVE_ACTIVITY_DEMO_BUSY", "Wait for the current operation to finish.", nil)
      return
    }
    isUpdating = true
    defer { isUpdating = false }
    do {
      try await operation()
      resolve(snapshot())
    } catch {
      reject("LIVE_ACTIVITY_DEMO_FAILED", error.localizedDescription, error)
    }
  }

  private func demoError(_ message: String) -> NSError {
    NSError(
      domain: "LiveActivityDemo",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }
}

@MainActor
private final class SwapLiveActivityManager {
  static let shared = SwapLiveActivityManager()
  private let defaults = UserDefaults.standard
  private let attemptedKey = "onekey.swapLiveActivity.attempted.v1"
  private var observers: [String: Task<Void, Never>] = [:]
  private var tokenObservers: [String: Task<Void, Never>] = [:]
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
    // The estimate becomes stale at the Almost done boundary, even if the app is suspended.
    ActivityContent(
      state: state,
      staleDate: state.status.isTerminal ? nil : order.estimatedEndAt.addingTimeInterval(-10),
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
    guard attempted[order.orderKey] == nil else { return }
    attempted = attempted.filter { $0.value > Date().timeIntervalSince1970 * 1000 }
    attempted[order.orderKey] = order.expiresAtMs
    defaults.set(attempted, forKey: attemptedKey)
    guard UIApplication.shared.applicationState == .active,
          ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    let attributes = SwapLiveActivityAttributes(
      order: order,
      fromIconName: iconName(order.fromToken.iconUrl),
      toIconName: iconName(order.toToken.iconUrl)
    )
    let state = SwapLiveActivityAttributes.ContentState.make(
      order: order, status: request.content.status,
      revision: request.content.revision, updatedAtMs: request.content.updatedAtMs
    )
    let activity = try Activity.request(
      attributes: attributes, content: content(state, order: order),
      pushType: order.isMock ? nil : .token
    )
    acceptedStates[activity.id] = state
    observe(activity)
    schedulePresentation(activity, status: state.status)
    Task {
      async let fromIcon: Void = cacheIcon(order.fromToken.iconUrl)
      async let toIcon: Void = cacheIcon(order.toToken.iconUrl)
      _ = await (fromIcon, toIcon)
      guard activity.activityState == .active || activity.activityState == .stale else { return }
      await mutate(activity) {
        var refreshed = self.currentState(activity)
        refreshed.imageRevision = 1
        await self.publish(refreshed, to: activity)
      }
    }
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
        displayPhase: statusChanged ? "eta" : previous.displayPhase
      )
      next.imageRevision = previous.imageRevision
      if next.status.isError {
        next.progressStoppedAtMs = previous.progressStoppedAtMs ?? next.progressStoppedAtMs
      }
      let needsPresentation = statusChanged || next.etaMinutes != previous.etaMinutes
        || next.almostDone != previous.almostDone
      self.acceptedStates[activity.id] = next
      guard needsPresentation else { return }
      let alert: AlertConfiguration? = statusChanged && (next.status.isTerminal || next.status == .refunding)
        ? AlertConfiguration(title: "OneKey Swap", body: self.alertText(next.status), sound: .default)
        : nil
      await self.publish(next, to: activity, alert: alert)
      if statusChanged { self.schedulePresentation(activity, status: next.status) }
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
    guard !activity.attributes.order.isMock else {
      pushStates[activity.id] = "notRequested"
      return
    }
    pushStates[activity.id] = "pending"
    tokenObservers[activity.id] = Task { [weak self] in
      for await token in activity.pushTokenUpdates {
        guard let self else { return }
        JPUSHService.registerLiveActivity(activity.id, pushToken: token, completion: { code, _, _, _ in
          Task { @MainActor in
            self.pushStates[activity.id] = code == 0 ? "registered" : "failed"
          }
        }, seq: 0)
      }
    }
  }

  private func unregisterPush(_ activity: Activity<SwapLiveActivityAttributes>) {
    tokenObservers.removeValue(forKey: activity.id)?.cancel()
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
        try? await Task.sleep(nanoseconds: 30_000_000_000)
        guard !Task.isCancelled else { return }
        await self.mutate(activity) {
          guard self.presentationGenerations[activity.id] == generation,
                self.currentState(activity).status.isTerminal else { return }
          await activity.end(
            self.content(self.currentState(activity), order: activity.attributes.order),
            dismissalPolicy: .after(Date().addingTimeInterval(180))
          )
        }
        return
      }
      // This is a local presentation update, never a substitute for server tracking.
      try? await Task.sleep(nanoseconds: 1_000_000_000)
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

  private func iconName(_ url: String) -> String {
    guard !url.isEmpty else { return "" }
    return SHA256.hash(data: Data(url.utf8)).map { String(format: "%02x", $0) }.joined() + ".png"
  }

  private func cacheIcon(_ value: String) async {
    guard let url = URL(string: value), url.scheme == "https",
          let directory = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.so.onekey.wallet"
          )?.appendingPathComponent("LiveActivityIcons", isDirectory: true) else { return }
    let file = directory.appendingPathComponent(iconName(value))
    guard !FileManager.default.fileExists(atPath: file.path) else { return }
    do {
      let (data, response) = try await URLSession.shared.data(from: url)
      guard let response = response as? HTTPURLResponse, response.statusCode == 200,
            data.count < 2_000_000, let image = UIImage(data: data) else { return }
      let size = CGSize(width: 138, height: 138)
      let normalized = UIGraphicsImageRenderer(size: size).image { _ in
        image.draw(in: CGRect(origin: .zero, size: size))
      }
      guard let png = normalized.pngData() else { return }
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try png.write(to: file, options: .atomic)
    } catch {
      // Token artwork is optional; a failed image download must not affect the activity.
    }
  }

  private func alertText(_ status: SwapLiveActivityStatus) -> LocalizedStringResource {
    switch status {
    case .done: return "Swap completed"
    case .refunding: return "Swap failed · Refund initiated"
    case .refunded: return "Refunded"
    case .canceled: return "Order canceled"
    default: return "Swap failed"
    }
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

  @objc(end:resolver:rejecter:)
  func end(_ orderKey: String, resolver resolve: @escaping RCTPromiseResolveBlock,
           rejecter reject: @escaping RCTPromiseRejectBlock) {
    run(resolve, reject) { await SwapLiveActivityManager.shared.end(orderKey) }
  }
}
