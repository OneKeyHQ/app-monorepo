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
// Composite the design's 20% white over black before WidgetKit renders the track.
private let swapProgressTrack = Color(.sRGB, red: 0.2, green: 0.2, blue: 0.2, opacity: 1)
private let swapSecondaryText = Color.white.opacity(0.6)

private struct SwapLocalizedContent<Content: View>: View {
  @AppStorage(SwapLiveActivitySharedLabels.key, store: SwapLiveActivitySharedLabels.defaults)
  private var labels = Data()
  let activityID: String
  @ViewBuilder let content: (SwapLiveActivityStrings?) -> Content

  var body: some View {
    content(SwapLiveActivitySharedLabels.decode(labels)[activityID])
  }
}

private extension ActivityViewContext where Attributes == SwapLiveActivityAttributes {
  var isNearCompletion: Bool {
    state.almostDone == true || attributes.order.nearCompletionDate.timeIntervalSinceNow < 0
  }

  func remoteStatusLabel(strings: SwapLiveActivityStrings?) -> String? {
    if state.isRefundFailed { return strings?.refundFailed ?? "Refund failed" }
    if state.isPartiallyFilled { return strings?.partiallyFilled ?? "Partially filled" }
    if state.isExpired { return strings?.expired ?? "Expired" }
    return nil
  }

  func lastUpdatedText(strings: SwapLiveActivityStrings?, usesSharedLabels: Bool) -> String? {
    guard let timestamp = state.updatedAtMs else { return nil }
    if !usesSharedLabels, let text = state.strings?.lastUpdated, !text.isEmpty { return text }
    let label = strings?.lastUpdatedLabel ?? "Last updated"
    let date = Date(timeIntervalSince1970: timestamp / 1000)
    let locale = strings?.locale.map { Locale(identifier: $0) } ?? .current
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
    guard !filename.isEmpty, let directory = SwapLiveActivityIconFiles.directory else { return nil }
    return UIImage(contentsOfFile: directory.appendingPathComponent(filename).path)
  }

  var body: some View {
    Group {
      if let image {
        Image(uiImage: image).renderingMode(.original).resizable().scaledToFit()
      } else if token.symbol == "BTC" {
        Image("SwapBitcoin").renderingMode(.original).resizable().scaledToFit()
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
  let context: ActivityViewContext<SwapLiveActivityAttributes>
  let size: CGFloat
  var overlapping = false

  var body: some View {
    let attributes = context.attributes
    let names = SwapLiveActivityIconFiles.names(for: context.activityID, attributes: attributes)
    HStack(spacing: overlapping ? -4 : 10) {
      SwapTokenIcon(token: attributes.order.fromToken,
                    filename: names.from, size: size)
        .zIndex(overlapping ? 1 : 0)
      SwapTokenIcon(token: attributes.order.toToken,
                    filename: names.to, size: size)
        .opacity(context.state.status.isError && !overlapping ? 0.5 : 1)
    }
  }
}

private struct SwapActivityETA: View {
  let context: ActivityViewContext<SwapLiveActivityAttributes>
  let strings: SwapLiveActivityStrings?
  var compact = false
  var pendingRingLabel: String?

  private var status: SwapLiveActivityStatus { context.state.status }
  private var order: SwapLiveActivityOrder { context.attributes.order }
  private var etaLocale: Locale { strings?.locale.map { Locale(identifier: $0) } ?? .current }
  private var estimatedMinutes: String {
    let duration = order.estimatedEndAt.timeIntervalSince(order.startedAt)
    return Int(ceil(duration / 60)).formatted(.number.locale(etaLocale))
  }
  private var fullEstimate: String {
    (strings?.etaTemplate ?? "~{number} min").replacingOccurrences(of: "{number}", with: estimatedMinutes)
  }
  private var nearCompletionText: String { strings?.almostDone ?? "~Almost done" }

  var body: some View {
    Group {
      if let label = context.remoteStatusLabel(strings: strings) {
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
    if context.isNearCompletion {
      nearCompletionLabel
    } else {
      let threshold = order.nearCompletionDate
      // WidgetKit advances timer progress in its archived view even while the App is suspended.
      // A nonempty interval shorter than a frame switches the two labels without a visible wipe.
      let transition = threshold...threshold.addingTimeInterval(0.001)
      let estimate = initialETA.mask { clockMask(transition, countsDown: true) }
      let almostDone = nearCompletionLabel.mask { clockMask(transition, countsDown: false) }
      Group {
        if compact {
          // Keep the island at the original ETA or ring width until its next system layout.
          estimate.overlay { almostDone }
        } else {
          ZStack(alignment: .trailing) {
            estimate
            almostDone
          }
        }
      }
      // The system advances the masks independently of the archived accessibility tree.
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text(verbatim: pendingRingLabel ?? fullEstimate))
      .accessibilityValue(Text(order.estimatedEndAt, style: .time))
      .accessibilityCustomContent(Text(verbatim: nearCompletionText), Text(threshold, style: .time))
      .environment(\.locale, etaLocale)
    }
  }

  @ViewBuilder
  private var initialETA: some View {
    if let pendingRingLabel {
      Image("SwapPendingRing").renderingMode(.original).resizable().scaledToFit()
        .frame(width: 22, height: 22)
        .accessibilityLabel(Text(pendingRingLabel))
    } else {
      minuteETA
    }
  }

  private func clockMask(_ interval: ClosedRange<Date>, countsDown: Bool) -> some View {
    GeometryReader { geometry in
      ProgressView(timerInterval: interval, countsDown: countsDown) {
        EmptyView()
      } currentValueLabel: {
        EmptyView()
      }
      .progressViewStyle(.linear)
      .tint(.white)
      // Extend the rounded ends beyond the label and cover both lines of a compact ETA.
      .frame(width: geometry.size.width + 12, height: 6)
      .scaleEffect(x: 1, y: 20)
      .position(x: geometry.size.width / 2, y: geometry.size.height / 2)
    }
    .background(.black)
    .compositingGroup()
    .contrast(15)
    .luminanceToAlpha()
    .accessibilityHidden(true)
  }

  @ViewBuilder
  private var nearCompletionLabel: some View {
    let label = nearCompletionText
    if compact {
      ViewThatFits(in: .horizontal) {
        Text(label).fixedSize(horizontal: true, vertical: false)
        Image(systemName: "hourglass.bottomhalf.filled")
      }
      .accessibilityLabel(Text(label))
    } else {
      Text(label)
    }
  }

  @ViewBuilder
  private var minuteETA: some View {
    let number = estimatedMinutes
    if let template = strings?.etaTemplate {
      let localizedTemplate = compact ? template.replacingOccurrences(of: "~", with: "", options: .anchored) : template
      if compact, let range = localizedTemplate.range(of: "{number}") {
        let prefix = String(localizedTemplate[..<range.lowerBound])
        let suffix = String(localizedTemplate[range.upperBound...]).trimmingCharacters(in: .whitespaces)
        let value = Text(number).font(.system(size: 13, weight: .heavy))
        let before = Text(suffix.isEmpty ? prefix.trimmingCharacters(in: .whitespaces) : prefix)
          .font(.system(size: 11, weight: .regular))
        let after = Text(suffix).font(.system(size: 11, weight: .regular))
        Group {
          if suffix.isEmpty {
            before + Text("\n") + value
          } else {
            before + value + Text("\n") + after
          }
        }
        .lineLimit(2)
        .multilineTextAlignment(.center)
        .frame(height: 25)
        .padding(.trailing, 3)
      } else {
        Text(localizedTemplate.replacingOccurrences(of: "{number}", with: number))
      }
    } else if compact {
      VStack(spacing: -4) {
        Text(number)
          .font(.system(size: 13, weight: .heavy))
        Text("min")
          .font(.system(size: 11, weight: .regular))
      }
      .frame(height: 25)
      .padding(.trailing, 3)
    } else {
      Text("~\(number) min")
    }
  }
}

private struct SwapActivityProgress: View {
  let context: ActivityViewContext<SwapLiveActivityAttributes>
  private let height: CGFloat = 10

  private var fixedProgress: Double? {
    let state = context.state
    let order = context.attributes.order
    // Real orders and push tests get their progress from ActivityKit updates.
    if order.isRealOrderOrPushTest, let progress = state.remoteProgress {
      return (0...1).contains(progress) ? progress : 0
    }
    if state.isTerminal && !state.isRefundFailed { return 1 }
    if order.isRealOrderOrPushTest { return 0 }
    guard state.status.isError || context.isStale else { return nil }
    let durationMs = order.estimatedEndAtMs - order.startedAtMs
    if let stoppedAtMs = state.progressStoppedAtMs ?? state.updatedAtMs,
       durationMs > 0 {
      return min(1, max(0, (stoppedAtMs - order.startedAtMs) / durationMs))
    }
    return 0
  }

  private func mockTimerTrack(width: CGFloat) -> some View {
    let order = context.attributes.order
    return ProgressView(timerInterval: order.startedAt...order.estimatedEndAt, countsDown: false) {
      EmptyView()
    } currentValueLabel: {
      EmptyView()
    }
    .tint(swapGreen)
    .scaleEffect(x: 1, y: 2.5, anchor: .center)
    .frame(width: width, height: height)
  }

  var body: some View {
    GeometryReader { geometry in
      Group {
        if let progress = fixedProgress {
          ZStack(alignment: .leading) {
            Capsule().fill(swapProgressTrack)
            Capsule().fill(context.state.status.isError ? swapRed : swapGreen)
              .frame(width: geometry.size.width * progress)
          }
        } else {
          mockTimerTrack(width: geometry.size.width)
        }
      }
      .clipShape(Capsule())
      .animation(.easeInOut(duration: 0.25), value: context.state.status)
    }
    .frame(height: height)
  }
}

private struct SwapActivityArrows: View {
  struct Update: Hashable {
    let status: SwapLiveActivityStatus
    let progress: Double?
  }

  let reversed: Bool
  let update: Update?
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isLuminanceReduced) private var isLuminanceReduced

  private let width: CGFloat = 34.9771
  private let height: CGFloat = 14

  private var arrowImage: some View {
    Image("SwapArrows").renderingMode(.original).resizable().scaledToFit()
      .frame(width: width, height: height)
  }

  var body: some View {
    ZStack {
      if !reduceMotion, !isLuminanceReduced, let update {
        ZStack {
          arrowImage
            .id(update)
            .transition(.push(from: .leading))
        }
        .animation(.easeInOut(duration: 0.625), value: update)
        .transition(.identity)
      } else {
        arrowImage.transition(.identity)
      }
    }
    .frame(width: width, height: height)
    .clipped()
    .environment(\.layoutDirection, .leftToRight)
    .rotationEffect(.degrees(reversed ? 180 : 0))
    .opacity(reversed ? 0.5 : 1)
    .accessibilityHidden(true)
  }
}

private struct SwapActivityDetails: View {
  let context: ActivityViewContext<SwapLiveActivityAttributes>
  let sharedLabels: SwapLiveActivityStrings?
  var expanded = false

  private var strings: SwapLiveActivityStrings? { sharedLabels ?? context.state.strings ?? context.attributes.strings }

  private var showsStaleTime: Bool {
    context.isStale && !context.state.isTerminal && !context.state.status.isError
  }

  private var arrowUpdate: SwapActivityArrows.Update? {
    let state = context.state
    guard !context.isStale, !state.isTerminal, state.status != .failed else { return nil }
    return .init(status: state.status, progress: state.remoteProgress)
  }

  private func ticker(_ value: String) -> String {
    value.count > 6 ? String(value.prefix(6)) + "…" : value
  }

  private var stepText: String? {
    if context.state.status.isTerminal { return nil }
    if sharedLabels == nil, let message = context.state.remoteMessage { return message }
    // The status beside the token pair already presents this label.
    if context.remoteStatusLabel(strings: strings) != nil { return nil }
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
        SwapActivityArrows(reversed: context.state.status.isRefund, update: arrowUpdate)
        Text(ticker(context.attributes.order.toToken.symbol))
          .opacity(context.state.status.isError ? 0.5 : 1)
        if !showsStaleTime {
          Spacer(minLength: 4)
          SwapActivityETA(context: context, strings: strings)
        }
      }
      .font(.system(size: 24, weight: .semibold))
      .foregroundStyle(.white)
      .lineLimit(1)
      .minimumScaleFactor(0.65)
      .frame(height: 24)
      VStack(alignment: .leading, spacing: expanded ? 4 : 6) {
        SwapActivityProgress(context: context)
        if let caption = (showsStaleTime
          ? context.lastUpdatedText(strings: strings, usesSharedLabels: sharedLabels != nil)
          : nil) ?? stepText {
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
  let sharedLabels: SwapLiveActivityStrings?

  private var strings: SwapLiveActivityStrings? { sharedLabels ?? context.state.strings ?? context.attributes.strings }

  private var statusLabel: String {
    if let label = context.remoteStatusLabel(strings: strings) { return label }
    if sharedLabels == nil, let message = context.state.remoteMessage {
      // The sender may have localized its success message using an older order language.
      if context.state.status == .done { return strings?.done ?? message }
      return message
    }
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
    } else if !context.isStale && (!context.state.status.isError || context.state.displayPhase == "eta") {
      let showsLocalRing = !context.attributes.usesRemoteUpdates && context.state.displayPhase != "eta"
      SwapActivityETA(context: context, strings: strings, compact: true,
                      pendingRingLabel: showsLocalRing ? statusLabel : nil)
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
          SwapTokenPair(context: context, size: 46)
          Spacer()
          Image("SwapOneKeyWordmark").resizable().scaledToFit().frame(width: 56, height: 16.2715)
        }
        SwapLocalizedContent(activityID: context.activityID) { labels in
          SwapActivityDetails(context: context, sharedLabels: labels)
        }
      }
      .padding(.horizontal, 30)
      .padding(.vertical, 16)
      .activityBackgroundTint(.black)
      .activitySystemActionForegroundColor(.white)
      .widgetURL(context.attributes.order.detailURL)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          SwapTokenPair(context: context, size: 40)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Image("SwapOneKeyWordmark").resizable().scaledToFit()
            .frame(width: 56, height: 16.2715)
        }
        DynamicIslandExpandedRegion(.bottom) {
          SwapLocalizedContent(activityID: context.activityID) { labels in
            SwapActivityDetails(context: context, sharedLabels: labels, expanded: true)
              .padding(.top, 2).padding(.bottom, 8)
          }
        }
      } compactLeading: {
        SwapTokenPair(context: context, size: 22, overlapping: true)
      } compactTrailing: {
        SwapLocalizedContent(activityID: context.activityID) { labels in
          SwapCompactStatus(context: context, sharedLabels: labels)
        }
      } minimal: {
        ZStack {
          Image("SwapMinimalRing").renderingMode(.original).resizable().scaledToFit()
            .frame(width: 26, height: 26)
          SwapTokenIcon(token: context.attributes.order.fromToken,
                        filename: SwapLiveActivityIconFiles.names(
                          for: context.activityID, attributes: context.attributes
                        ).from, size: 18)
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
