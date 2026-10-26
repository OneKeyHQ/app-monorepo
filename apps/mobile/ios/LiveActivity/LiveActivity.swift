import ActivityKit
import SwiftUI
import WidgetKit

struct OneKeyLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text(context.attributes.title)
          Spacer()
          Text("\(context.state.progress)%")
            .monospacedDigit()
        }
        ProgressView(value: Double(context.state.progress), total: 100)
        Text("Live Activity test · No transaction")
          .font(.caption)
      }
      .padding()
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          Text(context.attributes.title)
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            ProgressView(value: Double(context.state.progress), total: 100)
            Text("\(context.state.progress)%")
              .monospacedDigit()
          }
        }
      } compactLeading: {
        Text("1")
      } compactTrailing: {
        Text("\(context.state.progress)%")
          .monospacedDigit()
      } minimal: {
        Text("\(context.state.progress)%")
          .font(.caption2)
          .monospacedDigit()
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
