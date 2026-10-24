import ActivityKit
import SwiftUI
import WidgetKit
import UIKit

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
    SwapLiveActivityWidget()
    OneKeyLiveActivity()
  }
}

private let swapGreen = Color(red: 62 / 255, green: 220 / 255, blue: 47 / 255)
private let swapRed = Color(red: 210 / 255, green: 30 / 255, blue: 36 / 255)
private let swapOrange = Color(red: 247 / 255, green: 147 / 255, blue: 26 / 255)

private struct SwapTokenIcon: View {
  let token: SwapLiveActivityToken
  let filename: String
  let size: CGFloat

  private var image: UIImage? {
    guard !filename.isEmpty,
          let directory = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.so.onekey.wallet"
          ) else { return nil }
    return UIImage(contentsOfFile: directory
      .appendingPathComponent("LiveActivityIcons")
      .appendingPathComponent(filename).path)
  }

  var body: some View {
    Group {
      if token.symbol == "BTC" {
        Image("SwapBitcoin").renderingMode(.original).resizable().scaledToFit()
      } else if let image {
        Image(uiImage: image).renderingMode(.original).resizable().scaledToFit()
      } else if token.symbol == "USDC" {
        Image("SwapUSDC").resizable().scaledToFit()
      } else {
        Text(String(token.symbol.prefix(1)))
          .font(.system(size: size * 0.6, weight: .semibold))
          .foregroundStyle(.white)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .background(Color.gray)
      }
    }
    .frame(width: size, height: size)
    .clipShape(Circle())
    .accessibilityLabel(token.symbol)
  }
}

private struct SwapTokenPair: View {
  let attributes: SwapLiveActivityAttributes
  let status: SwapLiveActivityStatus
  let size: CGFloat
  var overlapping = false

  var body: some View {
    HStack(spacing: overlapping ? -4 : 10) {
      SwapTokenIcon(token: attributes.order.fromToken,
                    filename: attributes.fromIconName, size: size)
        .zIndex(overlapping ? 1 : 0)
      SwapTokenIcon(token: attributes.order.toToken,
                    filename: attributes.toIconName, size: size)
        .opacity(status.isError && !overlapping ? 0.5 : 1)
    }
  }
}

private struct SwapActivityETA: View {
  let context: ActivityViewContext<SwapLiveActivityAttributes>
  var compact = false

  private var status: SwapLiveActivityStatus { context.state.status }

  var body: some View {
    Group {
      switch status {
      case .done: Text("Done")
      case .failed: Text("Failed")
      case .refunded: Text("Refunded")
      case .canceled: Text("Order canceled")
      case .refunding: Text("Failed")
      default:
        if context.isStale || context.state.almostDone {
          Text("~Almost done")
        } else {
          if compact {
            VStack(spacing: -4) {
              Text("\(context.state.etaMinutes)")
                .font(.system(size: 13, weight: .heavy))
                .frame(height: 16)
              Text("min")
                .font(.system(size: 11, weight: .regular))
                .frame(height: 13)
            }
            .frame(height: 25)
          } else {
            Text("~\(context.state.etaMinutes) min")
          }
        }
      }
    }
    .font(.system(size: compact ? 13 : (status == .done ? 13 : 12), weight: .bold))
    .foregroundStyle(status == .done ? Color(red: 76 / 255, green: 201 / 255, blue: 123 / 255)
      : status.isError ? Color(red: 1, green: 92 / 255, blue: 92 / 255) : swapOrange)
    .lineLimit(1)
    .minimumScaleFactor(0.8)
    .monospacedDigit()
  }
}

private struct SwapActivityProgress: View {
  let context: ActivityViewContext<SwapLiveActivityAttributes>

  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule().fill(.white.opacity(0.2))
        if context.state.status.isTerminal {
          Capsule().fill(context.state.status.isError ? swapRed : swapGreen)
        } else if context.state.status.isRefund {
          Capsule().fill(swapRed)
            .frame(width: geometry.size.width * min(0.95, max(0,
              ((context.state.progressStoppedAtMs ?? context.state.updatedAtMs) - context.attributes.order.startedAtMs)
                / (context.attributes.order.estimatedEndAtMs - context.attributes.order.startedAtMs)
            )))
        } else {
          ProgressView(
            timerInterval: context.attributes.order.startedAt...context.attributes.order.startedAt.addingTimeInterval(
              context.attributes.order.estimatedEndAt.timeIntervalSince(context.attributes.order.startedAt) * 0.95
            ),
            countsDown: false
          ) { EmptyView() } currentValueLabel: { EmptyView() }
          .tint(swapGreen)
          .scaleEffect(x: 1, y: 2.5, anchor: .center)
          .frame(width: geometry.size.width * 0.95)
        }
      }
      .clipShape(Capsule())
    }
    .frame(height: 10)
  }
}

private struct SwapActivityDetails: View {
  let context: ActivityViewContext<SwapLiveActivityAttributes>
  var expanded = false

  private func ticker(_ value: String) -> String {
    value.count > 6 ? String(value.prefix(6)) + "…" : value
  }

  private var stepText: String? {
    switch context.state.status {
    case .confirming:
      return "Confirming on \(context.attributes.order.fromToken.networkName) network"
    case .swapping: return "Swap in progress"
    case .receiving:
      return "Confirming on \(context.attributes.order.toToken.networkName) network"
    case .refunding: return "Swap failed · Refund initiated"
    case .failed: return "Swap failed"
    default: return nil
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: expanded ? 8 : (context.state.status == .done ? 9 : 12)) {
      HStack(spacing: 9) {
        Text(ticker(context.attributes.order.fromToken.symbol))
        Image("SwapArrows").renderingMode(.original).resizable().scaledToFit()
        .frame(width: 34.9771, height: 14)
        .rotationEffect(.degrees(context.state.status.isRefund ? 180 : 0))
        .opacity(context.state.status.isRefund ? 0.5 : 1)
        .id(context.state.status)
        .transition(.push(from: .trailing))
        Text(ticker(context.attributes.order.toToken.symbol))
          .opacity(context.state.status.isError ? 0.5 : 1)
        Spacer(minLength: 4)
        SwapActivityETA(context: context)
      }
      .font(.system(size: 24, weight: .semibold))
      .foregroundStyle(.white)
      .lineLimit(1)
      .minimumScaleFactor(0.65)
      .frame(height: 24)
      VStack(alignment: .leading, spacing: expanded ? 4 : 6) {
        SwapActivityProgress(context: context)
        if let stepText {
          Text(stepText)
            .font(.system(size: 12, weight: .regular))
            .foregroundStyle(context.state.status.isError
              ? Color(red: 1, green: 92 / 255, blue: 92 / 255) : .white.opacity(0.6))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            // WidgetKit clips text overflowing the archived region bounds.
            .frame(height: 14)
        }
      }
    }
  }
}

private struct SwapCompactStatus: View {
  let context: ActivityViewContext<SwapLiveActivityAttributes>

  var body: some View {
    if context.state.status.isTerminal {
      Image(context.state.status == .done ? "SwapDone" : "SwapFailed")
        .renderingMode(.original).resizable().scaledToFit()
        .frame(width: 22, height: 22)
    } else if context.state.displayPhase == "eta" {
      SwapActivityETA(context: context, compact: true)
    } else {
      Image(context.state.status.isRefund ? "SwapRefundRing" : "SwapPendingRing")
      .renderingMode(.original).resizable().scaledToFit()
      .frame(width: 22, height: 22)
      .accessibilityLabel("Swap in progress")
    }
  }
}

struct SwapLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: SwapLiveActivityAttributes.self) { context in
      VStack(alignment: .leading, spacing: context.state.status == .done ? 9 : 12) {
        HStack(alignment: .top) {
          SwapTokenPair(attributes: context.attributes, status: context.state.status, size: 46)
          Spacer()
          Image("SwapOneKeyWordmark").resizable().scaledToFit().frame(width: 56, height: 16.2715)
        }
        SwapActivityDetails(context: context)
      }
      .padding(30)
      .activityBackgroundTint(.black)
      .activitySystemActionForegroundColor(.white)
      .widgetURL(context.attributes.order.detailURL)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          SwapTokenPair(attributes: context.attributes, status: context.state.status, size: 40)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Image("SwapOneKeyWordmark").resizable().scaledToFit()
            .frame(width: 56, height: 16.2715)
        }
        DynamicIslandExpandedRegion(.bottom) {
          SwapActivityDetails(context: context, expanded: true)
            .padding(.horizontal, 8).padding(.top, 2).padding(.bottom, 8)
        }
      } compactLeading: {
        SwapTokenPair(attributes: context.attributes, status: context.state.status,
                      size: 22, overlapping: true)
      } compactTrailing: {
        SwapCompactStatus(context: context)
      } minimal: {
        SwapTokenIcon(token: context.attributes.order.fromToken,
                      filename: context.attributes.fromIconName, size: 18)
          .padding(6)
          .background {
            Image("SwapMinimalRing").renderingMode(.original).resizable().scaledToFit()
          }
      }
      .contentMargins(.bottom, 14, for: .expanded)
      .widgetURL(context.attributes.order.detailURL)
      .keylineTint(context.state.status.isError ? swapRed : swapGreen)
    }
  }
}
