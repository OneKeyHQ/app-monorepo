import ActivityKit
import SwiftUI
import WidgetKit

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {}
}

struct OneKeyLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { _ in
      Text("OneKey")
        .padding()
    } dynamicIsland: { _ in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          Text("OneKey")
        }
      } compactLeading: {
        Text("1")
      } compactTrailing: {
        EmptyView()
      } minimal: {
        Text("1")
      }
    }
  }
}

@main
struct LiveActivityBundle: WidgetBundle {
  var body: some Widget {
    OneKeyLiveActivity()
  }
}
