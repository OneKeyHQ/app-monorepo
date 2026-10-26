import ActivityKit
import React
import UIKit

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
