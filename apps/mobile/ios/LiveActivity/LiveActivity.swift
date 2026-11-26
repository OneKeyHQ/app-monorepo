import ActivityKit
import SwiftUI
import WidgetKit
import UIKit

@main
struct LiveActivityBundle: WidgetBundle {
  var body: some Widget {
    SwapLiveActivityWidget()
  }
}

private let swapGreen = Color(red: 62 / 255, green: 220 / 255, blue: 47 / 255)
private let swapRed = Color(red: 210 / 255, green: 30 / 255, blue: 36 / 255)
private let swapOrange = Color(red: 247 / 255, green: 147 / 255, blue: 26 / 255)
private let swapSecondaryText = Color.white.opacity(0.6)

private extension ActivityViewContext where Attributes == SwapLiveActivityAttributes {
  var swapStrings: SwapLiveActivityStrings? { state.strings ?? attributes.strings }

  var remoteStatusLabel: String? {
    if state.isRefundFailed { return swapStrings?.refundFailed ?? "Refund failed" }
    if state.isPartiallyFilled { return swapStrings?.partiallyFilled ?? "Partially filled" }
    if state.isExpired { return swapStrings?.expired ?? "Expired" }
    return nil
  }

  var lastUpdatedText: String {
    if let text = state.strings?.lastUpdated { return text }
    let label = swapStrings?.lastUpdatedLabel ?? "Last updated"
    guard let timestamp = state.updatedAtMs else { return "\(label): —" }
    let date = Date(timeIntervalSince1970: timestamp / 1000)
    let locale = swapStrings?.locale.map { Locale(identifier: $0) } ?? .current
    let formatted = date.formatted(
      .dateTime.year().month(.abbreviated).day().hour().minute().locale(locale)
    )
    return "\(label): \(formatted)"
  }
}

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
  private var strings: SwapLiveActivityStrings? { context.swapStrings }
  private var order: SwapLiveActivityOrder { context.attributes.order }

  var body: some View {
    Group {
      if let label = context.remoteStatusLabel {
        Text(label)
      } else {
        switch status {
        case .done: Text(strings?.done ?? "Done")
        case .failed: Text(strings?.failed ?? "Failed")
        case .refunded: Text(strings?.refunded ?? "Refunded")
        case .canceled: Text(strings?.canceled ?? "Order canceled")
        case .refunding: Text(strings?.refunding ?? "Refunding")
        default: pendingETA
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

  @ViewBuilder
  private var pendingETA: some View {
    if order.isRealOrderOrPushTest {
      // The system advances timer digits without re-rendering the activity.
      if order.estimatedEndAt.timeIntervalSinceNow < 10 {
        Text(strings?.almostDone ?? "Almost done")
      } else {
        Text("≈\(order.estimatedEndAt, style: .time)")
      }
    } else if context.state.almostDone == true {
      Text(strings?.almostDone ?? "~Almost done")
    } else if let minutes = context.state.etaMinutes {
      if let template = strings?.etaTemplate {
        Text(template.replacingOccurrences(of: "{number}", with: String(minutes)))
      } else if compact {
        VStack(spacing: -4) {
          Text("\(minutes)")
            .font(.system(size: 13, weight: .heavy))
          Text("min")
            .font(.system(size: 9, weight: .regular))
        }
        .frame(height: 25)
      } else {
        Text("~\(minutes) min")
      }
    }
  }
}

private struct SwapActivityProgress: View {
  let context: ActivityViewContext<SwapLiveActivityAttributes>
  private let height: CGFloat = 10
  private let pendingLimit: CGFloat = 0.95

  private var frozenProgress: Double {
    let order = context.attributes.order
    let durationMs = order.estimatedEndAtMs - order.startedAtMs
    if let stoppedAtMs = context.state.progressStoppedAtMs ?? context.state.updatedAtMs,
       durationMs > 0 {
      return min(Double(pendingLimit), max(0, (stoppedAtMs - order.startedAtMs) / durationMs))
    }
    return min(Double(pendingLimit), max(0, context.state.remoteProgress ?? 0))
  }

  private func timerTrack(_ interval: ClosedRange<Date>, width: CGFloat) -> some View {
    ProgressView(timerInterval: interval, countsDown: false) {
      EmptyView()
    } currentValueLabel: {
      EmptyView()
    }
    .tint(swapGreen)
    .scaleEffect(x: 1, y: 2.5, anchor: .center)
    .frame(width: width, height: height)
  }

  private func pendingTrack(width: CGFloat) -> some View {
    let order = context.attributes.order
    let fillWidth = width * pendingLimit
    let emptyInterval = Date.distantFuture.addingTimeInterval(-60)...Date.distantFuture

    // Crop two full-width system tracks so their grey rails meet without a seam.
    // The leading track keeps updating through WidgetKit while the app is suspended.
    return HStack(spacing: 0) {
      timerTrack(order.startedAt...order.estimatedEndAt, width: width)
        .frame(width: fillWidth, height: height, alignment: .leading)
        .clipped()
      timerTrack(emptyInterval, width: width)
        .frame(width: width - fillWidth, height: height, alignment: .trailing)
        .clipped()
        .accessibilityHidden(true)
    }
  }

  var body: some View {
    GeometryReader { geometry in
      Group {
        if context.state.isTerminal && !context.state.isRefundFailed {
          Capsule().fill(context.state.status.isError ? swapRed : swapGreen)
        } else if context.state.status.isError || context.isStale {
          ZStack(alignment: .leading) {
            Capsule().fill(.white.opacity(0.2))
            Capsule().fill(context.state.status.isError ? swapRed : swapGreen)
              .frame(width: geometry.size.width * frozenProgress)
          }
        } else {
          pendingTrack(width: geometry.size.width)
        }
      }
      .clipShape(Capsule())
      .animation(.easeInOut(duration: 0.25), value: context.state.status)
    }
    .frame(height: height)
  }
}

private struct SwapActivityDetails: View {
  let context: ActivityViewContext<SwapLiveActivityAttributes>
  var expanded = false

  private var showsStaleTime: Bool {
    context.isStale && !context.state.isTerminal && !context.state.status.isError
  }

  private func ticker(_ value: String) -> String {
    value.count > 6 ? String(value.prefix(6)) + "…" : value
  }

  private var stepText: String? {
    if context.state.status.isTerminal { return nil }
    if let message = context.state.remoteMessage { return message }
    let strings = context.swapStrings
    switch context.state.status {
    case .confirming:
      return strings?.confirmingFrom ?? "Confirming on \(context.attributes.order.fromToken.networkName) network"
    case .swapping: return strings?.pending ?? "Swap in progress"
    case .receiving:
      return strings?.confirmingTo ?? "Confirming on \(context.attributes.order.toToken.networkName) network"
    case .refunding: return strings?.refunding ?? "Swap failed · Refund initiated"
    case .failed: return strings?.swapFailed ?? "Swap failed"
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
        if !showsStaleTime {
          Spacer(minLength: 4)
          SwapActivityETA(context: context)
        }
      }
      .font(.system(size: 24, weight: .semibold))
      .foregroundStyle(.white)
      .lineLimit(1)
      .minimumScaleFactor(0.65)
      .frame(height: 24)
      VStack(alignment: .leading, spacing: expanded ? 4 : 6) {
        SwapActivityProgress(context: context)
        if let caption = (showsStaleTime ? context.lastUpdatedText : nil) ?? stepText {
          Text(caption)
            .font(.system(size: 12, weight: .regular))
            .foregroundStyle(context.state.status.isError
              ? Color(red: 1, green: 92 / 255, blue: 92 / 255) : swapSecondaryText)
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

  private var statusLabel: String {
    if let label = context.remoteStatusLabel { return label }
    if let message = context.state.remoteMessage { return message }
    let strings = context.swapStrings
    switch context.state.status {
    case .confirming:
      return strings?.confirmingFrom ?? "Confirming on \(context.attributes.order.fromToken.networkName) network"
    case .swapping: return strings?.pending ?? "Swap in progress"
    case .receiving:
      return strings?.confirmingTo ?? "Confirming on \(context.attributes.order.toToken.networkName) network"
    case .refunding: return strings?.refunding ?? "Refunding"
    case .done: return strings?.done ?? "Done"
    case .failed: return strings?.failed ?? "Failed"
    case .refunded: return strings?.refunded ?? "Refunded"
    case .canceled: return strings?.canceled ?? "Order canceled"
    }
  }

  var body: some View {
    if context.state.isTerminal || context.state.status == .failed {
      Image(context.state.status == .done ? "SwapDone" : "SwapFailed")
        .renderingMode(.original).resizable().scaledToFit()
        .frame(width: 22, height: 22)
        .accessibilityLabel(Text(statusLabel))
    } else if !context.isStale && (context.state.displayPhase == "eta"
      || (!context.state.status.isError && context.attributes.usesRemoteUpdates)) {
      SwapActivityETA(context: context, compact: true)
    } else {
      Image(context.state.status.isRefund ? "SwapRefundRing" : "SwapPendingRing")
      .renderingMode(.original).resizable().scaledToFit()
      .frame(width: 22, height: 22)
      .accessibilityLabel(Text(statusLabel))
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
      .padding(.horizontal, 30)
      .padding(.vertical, 16)
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
            .padding(.top, 2).padding(.bottom, 8)
        }
      } compactLeading: {
        SwapTokenPair(attributes: context.attributes, status: context.state.status,
                      size: 22, overlapping: true)
      } compactTrailing: {
        SwapCompactStatus(context: context)
      } minimal: {
        ZStack {
          Image("SwapMinimalRing").renderingMode(.original).resizable().scaledToFit()
            .frame(width: 26, height: 26)
          SwapTokenIcon(token: context.attributes.order.fromToken,
                        filename: context.attributes.fromIconName, size: 18)
        }
        .frame(width: 30, height: 30)
      }
      .contentMargins(.horizontal, 24, for: .expanded)
      .contentMargins(.bottom, 14, for: .expanded)
      .widgetURL(context.attributes.order.detailURL)
      .keylineTint(context.state.status.isError ? swapRed : swapGreen)
    }
  }
}
