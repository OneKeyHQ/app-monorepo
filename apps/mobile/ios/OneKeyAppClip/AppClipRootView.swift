import Charts
import StoreKit
import SwiftUI
import UIKit

struct AppClipRootView: View {
  @ObservedObject var model: AppClipModel
  @State private var selectedCandleID: AppClipCandle.ID?
  private let overlayPresenter = AppInstallOverlayPresenter.shared

  var body: some View {
    Group {
      switch model.screen {
      case .market:
        marketList
      case .detail(let asset):
        marketDetail(asset)
      case .web(let url):
        webExperience(url)
      }
    }
    .background(Color.appClipBackground.ignoresSafeArea())
  }

  private var marketList: some View {
    VStack(spacing: 0) {
      marketHeader
      Group {
        if model.assets.isEmpty {
          marketEmptyState
        } else {
          ScrollView {
            LazyVStack(spacing: 0) {
              ForEach(model.assets) { asset in
                Button {
                  selectedCandleID = nil
                  model.select(asset)
                } label: {
                  MarketAssetRow(asset: asset)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("app-clip-market-\(asset.id)")
              }
            }
          }
          .refreshable {
            await model.refreshMarkets()
          }
        }
      }
      installFooter(asset: nil)
    }
  }

  private var marketHeader: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(String(localized: "market.title"))
        .font(.system(size: 28, weight: .bold))
        .foregroundColor(.primary)
      Text(marketStatusText)
        .font(.system(size: 16, weight: .regular))
        .foregroundColor(.appClipSecondaryText)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 20)
    .padding(.top, 18)
    .padding(.bottom, 18)
  }

  private var marketEmptyState: some View {
    VStack(spacing: 14) {
      if model.isRefreshing {
        ProgressView()
        Text(String(localized: "market.refreshing"))
          .font(.subheadline)
          .foregroundColor(.appClipSecondaryText)
      } else {
        Image(systemName: "wifi.exclamationmark")
          .font(.system(size: 28, weight: .medium))
          .foregroundColor(.appClipSecondaryText)
        Text(String(localized: "market.unavailable"))
          .font(.subheadline)
          .foregroundColor(.appClipSecondaryText)
        retryButton {
          Task { await model.refreshMarkets() }
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private func marketDetail(_ asset: AppClipMarketAsset) -> some View {
    VStack(spacing: 0) {
      HStack(spacing: 12) {
        Button {
          selectedCandleID = nil
          model.showMarket()
        } label: {
          Image(systemName: "chevron.left")
            .font(.system(size: 16, weight: .semibold))
            .foregroundColor(.primary)
            .frame(width: 44, height: 44)
            .background(Color.appClipSurface)
            .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("app-clip-market-back")
        TokenLogo(asset: asset)
          .frame(width: 44, height: 44)
          .accessibilityIdentifier("app-clip-detail-token-logo")
        Spacer()
      }
      .frame(height: 64)
      .padding(.horizontal, 20)

      VStack(alignment: .leading, spacing: 5) {
        Text(asset.symbol)
          .font(.system(size: 32, weight: .bold))
          .foregroundColor(.primary)
          .lineLimit(1)
        Text("\(asset.detailSubtitle) · Spot")
          .font(.system(size: 14, weight: .medium))
          .foregroundColor(.appClipSecondaryText)
          .lineLimit(1)
        Text(formattedPrice(selectedCandle?.c ?? asset.price))
          .font(.system(size: 40, weight: .bold))
          .foregroundColor(.primary)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.55)
          .padding(.top, 5)
          .accessibilityIdentifier("app-clip-detail-price")
        HStack(spacing: 6) {
          Text(formattedPercentage(asset.priceChangePercent))
            .foregroundColor(changeColor(asset.priceChangePercent))
          Text("24h")
            .foregroundColor(.appClipSecondaryText)
        }
        .font(.system(size: 18, weight: .semibold))
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 20)
      .padding(.top, 4)
      .padding(.bottom, 6)

      chartState(asset: asset)
        .frame(minHeight: 260)
        .layoutPriority(1)

      HStack(spacing: 8) {
        ForEach(["1m", "15m", "1H", "4H"], id: \.self) { interval in
          Button {
            selectedCandleID = nil
            Task { await model.selectInterval(interval, asset: asset) }
          } label: {
            Text(interval)
              .font(.system(size: 14, weight: .semibold))
              .foregroundColor(
                interval == model.selectedInterval ? .appClipBackground : .appClipSecondaryText
              )
              .frame(maxWidth: .infinity)
              .frame(height: 32)
              .background(
                interval == model.selectedInterval ? Color.primary : .clear
              )
              .clipShape(Capsule())
          }
          .buttonStyle(.plain)
          .accessibilityIdentifier("app-clip-interval-\(interval)")
        }
      }
      .padding(.horizontal, 12)
      .padding(.top, 7)
      .padding(.bottom, 5)

      Label(String(localized: "market.powered_by"), systemImage: "bolt.fill")
        .font(.system(size: 12, weight: .medium))
        .foregroundColor(.appClipSecondaryText)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 6)

      installFooter(asset: asset, usesDetailStyle: true)
    }
    .background(Color.appClipBackground.ignoresSafeArea())
  }

  @ViewBuilder
  private func chartState(asset: AppClipMarketAsset) -> some View {
    if model.isLoadingCandles {
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    } else if model.candleLoadFailed || model.candles.isEmpty {
      VStack(spacing: 12) {
        Image(systemName: "chart.xyaxis.line")
          .font(.system(size: 28))
          .foregroundColor(.appClipSecondaryText)
        Text(String(localized: "chart.unavailable"))
          .font(.subheadline)
          .foregroundColor(.appClipSecondaryText)
        retryButton {
          model.retryCandles(asset: asset)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    } else {
      PriceChart(
        candles: model.candles,
        selectedCandleID: $selectedCandleID
      )
      .padding(.horizontal, 12)
    }
  }

  private var selectedCandle: AppClipCandle? {
    guard let selectedCandleID else {
      return nil
    }
    return model.candles.first { $0.id == selectedCandleID }
  }

  private func webExperience(_ url: URL) -> some View {
    VStack(spacing: 0) {
      simpleHeader(
        title: String(localized: "campaign.title"),
        subtitle: String(localized: "campaign.secure_webview")
      )
      CampaignWebView(url: url)
      installFooter(asset: nil)
    }
  }

  private func simpleHeader(title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(title)
        .font(.system(size: 28, weight: .bold))
      Text(subtitle)
        .font(.system(size: 16))
        .foregroundColor(.appClipSecondaryText)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 20)
    .padding(.vertical, 18)
  }

  private func retryButton(action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(String(localized: "global.retry"))
        .font(.system(size: 14, weight: .semibold))
        .foregroundColor(.primary)
        .padding(.horizontal, 18)
        .frame(height: 36)
        .background(Color.appClipSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
    .buttonStyle(.plain)
  }

  private func installFooter(
    asset: AppClipMarketAsset?,
    usesDetailStyle: Bool = false
  ) -> some View {
    VStack(spacing: 8) {
      Button {
        let fullAppURL = model.recordInstallCTA(asset: asset)
        overlayPresenter.openFullAppOrPresent(
          fullAppURL: fullAppURL,
          campaignToken: model.campaignToken
        )
      } label: {
        Text(
          asset.map { String(format: String(localized: "cta.trade_symbol"), $0.symbol) }
            ?? String(localized: "cta.trade")
        )
        .font(.system(size: 17, weight: .semibold))
        .foregroundColor(.appClipAccentText)
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .background(Color.appClipAccent)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("app-clip-install-cta")
      Text(String(localized: "cta.note"))
        .font(.system(size: 13))
        .foregroundColor(.appClipSecondaryText)
    }
    .padding(.horizontal, 18)
    .padding(.top, 12)
    .padding(.bottom, 10)
    .background(usesDetailStyle ? Color.appClipBackground : Color.appClipFooter)
    .overlay(alignment: .top) {
      Divider()
        .background(Color.appClipSeparator)
    }
  }

  private var marketStatusText: String {
    let time = model.lastUpdated.map { Self.statusTimeFormatter.string(from: $0) }
    if model.marketRefreshFailed {
      if let time {
        return String(format: String(localized: "market.update_failed"), time)
      }
      return String(localized: "market.unavailable")
    }
    return model.isRefreshing && model.assets.isEmpty
      ? String(localized: "market.refreshing")
      : String(localized: "market.realtime")
  }

  private static let statusTimeFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .none
    formatter.timeStyle = .short
    return formatter
  }()
}

private struct MarketAssetRow: View {
  let asset: AppClipMarketAsset

  var body: some View {
    HStack(spacing: 0) {
      HStack(spacing: 12) {
        TokenLogo(asset: asset)
        VStack(alignment: .leading, spacing: 2) {
          Text(asset.symbol)
            .font(.system(size: 16, weight: .medium))
            .foregroundColor(.primary)
            .lineLimit(1)
          if let turnover = asset.turnover, turnover > 0 {
            Text(formattedMarketAmount(turnover))
              .font(.system(size: 14))
              .foregroundColor(.appClipSecondaryText)
              .lineLimit(1)
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      HStack(spacing: 8) {
        Text(formattedPrice(asset.price))
          .font(.system(size: 16, weight: .medium))
          .foregroundColor(.primary)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        PriceChangeBadge(change: asset.priceChangePercent)
      }
    }
    .contentShape(Rectangle())
    .padding(.horizontal, 20)
    .padding(.vertical, 12)
  }
}

private struct TokenLogo: View {
  let asset: AppClipMarketAsset

  var body: some View {
    RemoteImage(urls: asset.logoURLs, fallbackSystemName: "bitcoinsign.circle.fill")
      .frame(width: 32, height: 32)
      .clipShape(Circle())
      .overlay(alignment: .bottomTrailing) {
        if let networkLogoURL = asset.networkLogoURL {
          RemoteImage(urls: [networkLogoURL], fallbackSystemName: "link.circle.fill")
            .frame(width: 14, height: 14)
            .clipShape(Circle())
            .overlay(Circle().stroke(Color.appClipBackground, lineWidth: 2))
            .offset(x: 2, y: 2)
        }
      }
  }
}

private struct RemoteImage: View {
  let urls: [URL]
  let fallbackSystemName: String
  @State private var currentIndex = 0

  var body: some View {
    if urls.indices.contains(currentIndex) {
      AsyncImage(url: urls[currentIndex]) { phase in
        switch phase {
        case .empty:
          Color.appClipSurface.overlay(ProgressView().controlSize(.mini))
        case .success(let image):
          image.resizable().scaledToFill()
        case .failure:
          fallback
            .onAppear {
              guard currentIndex + 1 < urls.count else {
                return
              }
              DispatchQueue.main.async {
                currentIndex += 1
              }
            }
        @unknown default:
          fallback
        }
      }
    } else {
      fallback
    }
  }

  private var fallback: some View {
    Color.appClipSurface.overlay(
      Image(systemName: fallbackSystemName)
        .resizable()
        .scaledToFit()
        .foregroundColor(.appClipSecondaryText)
        .padding(3)
    )
  }
}

private struct PriceChangeBadge: View {
  let change: Double?

  var body: some View {
    Text(formattedPercentage(change))
      .font(.system(size: 14, weight: .medium))
      .foregroundColor(.white)
      .lineLimit(1)
      .minimumScaleFactor(0.75)
      .frame(width: 80, height: 32)
      .background(badgeColor)
      .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
  }

  private var badgeColor: Color {
    guard let change else {
      return .appClipNeutralStrong
    }
    if change > 0 {
      return .appClipPositive
    }
    if change < 0 {
      return .appClipNegative
    }
    return .appClipNeutralStrong
  }
}

private struct PriceChart: View {
  let candles: [AppClipCandle]
  @Binding var selectedCandleID: AppClipCandle.ID?

  var body: some View {
    Group {
      if #available(iOS 16.0, *) {
        AppleMarketChart(
          candles: candles,
          selectedCandleID: $selectedCandleID
        )
      } else {
        LegacyMarketChart(candles: candles, selectedCandleID: $selectedCandleID)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.appClipChart)
  }
}

@available(iOS 16.0, *)
private struct AppleMarketChart: View {
  let candles: [AppClipCandle]
  @Binding var selectedCandleID: AppClipCandle.ID?

  var body: some View {
    let priceDomain = chartPriceDomain(candles)
    let lineColor = chartTrendColor(candles)

    Chart {
      ForEach(candles) { candle in
        LineMark(
          x: .value("Time", Date(timeIntervalSince1970: candle.t)),
          y: .value("Price", candle.c)
        )
        .foregroundStyle(lineColor)
        .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
      }
      if let selectedCandle {
        let selectedDate = Date(timeIntervalSince1970: selectedCandle.t)
        RuleMark(x: .value("Selected time", selectedDate))
          .foregroundStyle(Color.appClipSecondaryText.opacity(0.5))
          .lineStyle(StrokeStyle(lineWidth: 1))
        PointMark(
          x: .value("Selected time", selectedDate),
          y: .value("Selected close", selectedCandle.c)
        )
        .symbol {
          ChartPoint(color: lineColor)
        }
      } else if let lastCandle = candles.last {
        PointMark(
          x: .value("Latest time", Date(timeIntervalSince1970: lastCandle.t)),
          y: .value("Latest close", lastCandle.c)
        )
        .symbol {
          ChartPoint(color: lineColor)
        }
      }
    }
    .chartXScale(domain: chartTimeDomain)
    .chartYScale(domain: priceDomain)
    .chartXAxis(.hidden)
    .chartYAxis(.hidden)
    .chartOverlay { proxy in
      GeometryReader { geometry in
        let plotFrame = geometry[proxy.plotAreaFrame]
        ZStack(alignment: .topLeading) {
          Rectangle()
            .fill(Color.clear)
            .contentShape(Rectangle())
            .highPriorityGesture(
              DragGesture(minimumDistance: 0)
                .onChanged { value in
                  let plotX = min(
                    max(value.location.x - plotFrame.minX, 0),
                    plotFrame.width
                  )
                  if let date = proxy.value(atX: plotX, as: Date.self),
                    let candle = nearestCandle(to: date, in: candles)
                  {
                    selectedCandleID = candle.id
                  } else if let candle = candle(at: plotX, width: plotFrame.width, in: candles) {
                    selectedCandleID = candle.id
                  }
                }
                .onEnded { _ in
                  selectedCandleID = nil
                }
            )
          if let selectedCandle,
            let chartX = proxy.position(
              forX: Date(timeIntervalSince1970: selectedCandle.t)
            )
          {
            ChartSelectionTooltip(candle: selectedCandle)
              .frame(width: 208)
              .position(
                x: min(
                  max(plotFrame.minX + chartX, plotFrame.minX + 104),
                  plotFrame.maxX - 104
                ),
                y: plotFrame.minY + 38
              )
          }
        }
      }
    }
  }

  private var chartTimeDomain: ClosedRange<Date> {
    let first = candles.first.map { Date(timeIntervalSince1970: $0.t) } ?? Date()
    let last = candles.last.map { Date(timeIntervalSince1970: $0.t) } ?? first
    let duration = max(last.timeIntervalSince(first), 1)
    let padding = duration * 0.02
    return first.addingTimeInterval(-padding)...last.addingTimeInterval(padding)
  }

  private var selectedCandle: AppClipCandle? {
    guard let selectedCandleID else {
      return nil
    }
    return candles.first { $0.id == selectedCandleID }
  }
}

private struct LegacyMarketChart: View {
  let candles: [AppClipCandle]
  @Binding var selectedCandleID: AppClipCandle.ID?

  var body: some View {
    GeometryReader { geometry in
      let horizontalInset: CGFloat = 8
      let plotWidth = max(geometry.size.width - horizontalInset * 2, 1)
      ZStack(alignment: .topLeading) {
        Canvas { context, size in
          drawChart(context: context, size: size)
        }
        Rectangle()
          .fill(Color.clear)
          .contentShape(Rectangle())
          .highPriorityGesture(
            DragGesture(minimumDistance: 0)
              .onChanged { value in
                let x = min(max(value.location.x - horizontalInset, 0), plotWidth)
                let rawIndex = x / plotWidth * CGFloat(candles.count - 1)
                let index = min(
                  max(Int(rawIndex.rounded()), 0),
                  max(candles.count - 1, 0)
                )
                guard candles.indices.contains(index) else {
                  return
                }
                selectedCandleID = candles[index].id
              }
              .onEnded { _ in
                selectedCandleID = nil
              }
          )
        if let selectedCandle,
          let selectedIndex = candles.firstIndex(of: selectedCandle)
        {
          let denominator = CGFloat(max(candles.count - 1, 1))
          let x = horizontalInset + plotWidth * CGFloat(selectedIndex) / denominator
          ChartSelectionTooltip(candle: selectedCandle)
            .frame(width: 208)
            .position(
              x: min(max(x, 104), geometry.size.width - 104),
              y: 38
            )
        }
      }
    }
  }

  private var selectedCandle: AppClipCandle? {
    guard let selectedCandleID else {
      return nil
    }
    return candles.first { $0.id == selectedCandleID }
  }

  private func drawChart(context: GraphicsContext, size: CGSize) {
    guard !candles.isEmpty else {
      return
    }
    let priceDomain = chartPriceDomain(candles)
    let lowerBound = priceDomain.lowerBound
    let range = priceDomain.upperBound - lowerBound
    let horizontalInset: CGFloat = 8
    let verticalInset: CGFloat = 14
    let width = max(size.width - horizontalInset * 2, 1)
    let height = max(size.height - verticalInset * 2, 1)
    let denominator = CGFloat(max(candles.count - 1, 1))
    let lineColor = chartTrendColor(candles)

    func y(_ value: Double) -> CGFloat {
      verticalInset + height * (1 - CGFloat((value - lowerBound) / range))
    }

    var line = Path()
    for (index, candle) in candles.enumerated() {
      let x = horizontalInset + width * CGFloat(index) / denominator
      let point = CGPoint(x: x, y: y(candle.c))
      if index == 0 {
        line.move(to: point)
      } else {
        line.addLine(to: point)
      }
    }
    context.stroke(
      line,
      with: .color(lineColor),
      style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round)
    )

    let activeCandle = selectedCandle ?? candles.last
    guard let activeCandle, let activeIndex = candles.firstIndex(of: activeCandle) else {
      return
    }
    let x = horizontalInset + width * CGFloat(activeIndex) / denominator
    if selectedCandle != nil {
      var crosshair = Path()
      crosshair.move(to: CGPoint(x: x, y: verticalInset))
      crosshair.addLine(to: CGPoint(x: x, y: size.height - verticalInset))
      context.stroke(
        crosshair,
        with: .color(Color.appClipSecondaryText.opacity(0.5)),
        lineWidth: 1
      )
    }
    let pointY = y(activeCandle.c)
    let halo = CGRect(x: x - 9, y: pointY - 9, width: 18, height: 18)
    let point = CGRect(x: x - 4, y: pointY - 4, width: 8, height: 8)
    context.fill(Path(ellipseIn: halo), with: .color(lineColor.opacity(0.16)))
    context.fill(Path(ellipseIn: point), with: .color(lineColor))
  }
}

private struct ChartPoint: View {
  let color: Color

  var body: some View {
    ZStack {
      Circle()
        .fill(color.opacity(0.16))
        .frame(width: 18, height: 18)
      Circle()
        .fill(color)
        .frame(width: 8, height: 8)
    }
  }
}

private struct ChartSelectionTooltip: View {
  let candle: AppClipCandle

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(formattedChartDate(candle.t))
          .foregroundColor(.appClipSecondaryText)
        Spacer(minLength: 0)
        Text(formattedChartPrice(candle.c))
          .fontWeight(.semibold)
      }
      Text("O \(formattedChartPrice(candle.o))  H \(formattedChartPrice(candle.h))")
      Text("L \(formattedChartPrice(candle.l))  V \(formattedChartVolume(candle.v))")
    }
    .font(.system(size: 9, weight: .medium, design: .monospaced))
    .foregroundColor(.primary)
    .padding(.horizontal, 8)
    .padding(.vertical, 6)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.appClipFooter.opacity(0.96))
    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .stroke(Color.appClipSeparator, lineWidth: 1)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityIdentifier("app-clip-chart-selection")
    .accessibilityLabel(chartSelectionAccessibilityLabel(candle))
  }
}

@MainActor
private final class AppInstallOverlayPresenter: NSObject, @preconcurrency SKOverlayDelegate {
  static let shared = AppInstallOverlayPresenter()

  private static let appStoreURL = URL(
    string: "itms-apps://apps.apple.com/app/id1609559473"
  )
  private static let appStoreWebURL = URL(
    string: "https://apps.apple.com/app/id1609559473"
  )

  private var overlay: SKOverlay?
  private var activeOperationID = UUID()
  private var didFallbackToAppStore = false

  func openFullAppOrPresent(fullAppURL: URL?, campaignToken: String?) {
    let operationID = beginOperation()
    guard
      let fullAppURL,
      let handoffURL = Self.handoffURL(for: fullAppURL)
    else {
      presentFullApp(campaignToken: campaignToken, operationID: operationID)
      return
    }
    UIApplication.shared.open(handoffURL) { [weak self] opened in
      Task { @MainActor in
        guard let self, operationID == self.activeOperationID, !opened else {
          return
        }
        self.presentFullApp(campaignToken: campaignToken, operationID: operationID)
      }
    }
  }

  private func beginOperation() -> UUID {
    overlay?.delegate = nil
    overlay = nil
    let operationID = UUID()
    activeOperationID = operationID
    didFallbackToAppStore = false
    return operationID
  }

  private static func handoffURL(for canonicalURL: URL) -> URL? {
    var components = URLComponents()
    components.scheme = "onekey-wallet"
    components.host = "app-clip"
    components.queryItems = [
      URLQueryItem(name: "url", value: canonicalURL.absoluteString)
    ]
    return components.url
  }

  private func presentFullApp(campaignToken: String?, operationID: UUID) {
    guard operationID == activeOperationID else {
      return
    }
    guard
      let scene = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .first(where: { $0.activationState == .foregroundActive })
    else {
      openAppStore(operationID: operationID)
      return
    }
    let configuration = SKOverlay.AppClipConfiguration(position: .bottom)
    configuration.campaignToken = campaignToken
    let overlay = SKOverlay(configuration: configuration)
    overlay.delegate = self
    self.overlay = overlay
    overlay.present(in: scene)
  }

  func storeOverlayDidFailToLoad(_ overlay: SKOverlay, error: any Error) {
    guard overlay === self.overlay else {
      return
    }
    openAppStore(operationID: activeOperationID)
  }

  private func openAppStore(operationID: UUID) {
    guard operationID == activeOperationID, !didFallbackToAppStore else {
      return
    }
    didFallbackToAppStore = true
    overlay?.delegate = nil
    overlay = nil
    #if targetEnvironment(simulator)
      openAppStoreWebPage(operationID: operationID)
    #else
      guard let appStoreURL = Self.appStoreURL else {
        openAppStoreWebPage(operationID: operationID)
        return
      }
      UIApplication.shared.open(appStoreURL) { [weak self] opened in
        guard !opened else {
          return
        }
        Task { @MainActor in
          self?.openAppStoreWebPage(operationID: operationID)
        }
      }
    #endif
  }

  private func openAppStoreWebPage(operationID: UUID) {
    guard operationID == activeOperationID, let appStoreWebURL = Self.appStoreWebURL else {
      return
    }
    UIApplication.shared.open(appStoreWebURL)
  }
}

private func formattedPrice(_ value: Double?) -> String {
  guard let value, value.isFinite else {
    return "--"
  }
  let formatter = NumberFormatter()
  formatter.locale = Locale.current
  formatter.numberStyle = .currency
  formatter.currencyCode = "USD"
  formatter.currencySymbol = "$"
  if abs(value) >= 1 {
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = abs(value) >= 1_000 ? 2 : 4
  } else if abs(value) >= 0.01 {
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = 4
  } else {
    formatter.minimumFractionDigits = 4
    formatter.maximumFractionDigits = 8
  }
  return formatter.string(from: NSNumber(value: value)) ?? "--"
}

private func formattedPercentage(_ value: Double?) -> String {
  guard let value, value.isFinite else {
    return "--"
  }
  return String(format: "%+.2f%%", value)
}

private func formattedMarketAmount(_ value: Double?) -> String {
  guard let value, value.isFinite, value > 0 else {
    return "--"
  }
  let absoluteValue = abs(value)
  let amount: Double
  let suffix: String
  switch absoluteValue {
  case 1_000_000_000_000...:
    amount = value / 1_000_000_000_000
    suffix = "T"
  case 1_000_000_000...:
    amount = value / 1_000_000_000
    suffix = "B"
  case 1_000_000...:
    amount = value / 1_000_000
    suffix = "M"
  case 1_000...:
    amount = value / 1_000
    suffix = "K"
  default:
    amount = value
    suffix = ""
  }
  return String(format: "$%.2f%@", amount, suffix)
}

private func changeColor(_ value: Double?) -> Color {
  guard let value else {
    return .appClipSecondaryText
  }
  if value > 0 {
    return .appClipPositive
  }
  if value < 0 {
    return .appClipNegative
  }
  return .appClipSecondaryText
}

private func chartTrendColor(_ candles: [AppClipCandle]) -> Color {
  guard let first = candles.first, let last = candles.last else {
    return .appClipPositive
  }
  return last.c >= first.c ? .appClipPositive : .appClipNegative
}

private func chartPriceDomain(_ candles: [AppClipCandle]) -> ClosedRange<Double> {
  let lowest = candles.map(\.c).min() ?? 0
  let highest = candles.map(\.c).max() ?? 0
  let baseline = max(abs(lowest), abs(highest))
  let minimumPadding = baseline > 0 ? baseline * 0.000_001 : 0.000_001
  let padding = max((highest - lowest) * 0.12, minimumPadding)
  return (lowest - padding)...(highest + padding)
}

private func formattedChartPrice(_ value: Double) -> String {
  let fractionLength: ClosedRange<Int>
  if abs(value) >= 1 {
    fractionLength = 2...2
  } else if abs(value) >= 0.0001 {
    fractionLength = 0...8
  } else {
    fractionLength = 0...10
  }
  return value.formatted(.number.precision(.fractionLength(fractionLength)))
}

private func formattedChartDate(_ timestamp: Double) -> String {
  Date(timeIntervalSince1970: timestamp).formatted(date: .numeric, time: .shortened)
}

private func formattedChartVolume(_ value: Double) -> String {
  guard value.isFinite else {
    return "--"
  }
  return value.formatted(.number.precision(.fractionLength(0...4)))
}

private func nearestCandle(
  to date: Date,
  in candles: [AppClipCandle]
) -> AppClipCandle? {
  candles.min {
    abs($0.t - date.timeIntervalSince1970) < abs($1.t - date.timeIntervalSince1970)
  }
}

private func candle(
  at x: CGFloat,
  width: CGFloat,
  in candles: [AppClipCandle]
) -> AppClipCandle? {
  guard !candles.isEmpty, width > 0 else {
    return nil
  }
  let progress = min(max(x / width, 0), 1)
  let index = min(Int((progress * CGFloat(candles.count)).rounded(.down)), candles.count - 1)
  return candles[index]
}

private func chartSelectionAccessibilityLabel(_ candle: AppClipCandle) -> String {
  [
    formattedChartDate(candle.t),
    "O \(formattedChartPrice(candle.o))",
    "H \(formattedChartPrice(candle.h))",
    "L \(formattedChartPrice(candle.l))",
    "C \(formattedChartPrice(candle.c))",
    "V \(formattedChartVolume(candle.v))",
  ].joined(separator: ", ")
}

extension Color {
  fileprivate static let appClipBackground = adaptive(light: 0xFFFFFF, dark: 0x000000)
  fileprivate static let appClipSurface = adaptive(light: 0xF0F0F0, dark: 0x222222)
  fileprivate static let appClipFooter = adaptive(light: 0xFCFCFC, dark: 0x111111)
  fileprivate static let appClipChart = adaptive(light: 0xFFFFFF, dark: 0x000000)
  fileprivate static let appClipSeparator = adaptive(light: 0xE8E8E8, dark: 0x2A2A2A)
  fileprivate static let appClipSecondaryText = adaptive(light: 0x646464, dark: 0xB4B4B4)
  fileprivate static let appClipNeutralStrong = adaptive(light: 0x8D8D8D, dark: 0x6E6E6E)
  fileprivate static let appClipPositive = adaptive(light: 0x30A46C, dark: 0x30A46C)
  fileprivate static let appClipNegative = adaptive(light: 0xE5484D, dark: 0xE5484D)
  fileprivate static let appClipAccent = adaptive(light: 0x22AB15, dark: 0x3EDC2F)
  fileprivate static let appClipAccentText = adaptive(light: 0x000000, dark: 0x000000)

  private static func adaptive(light: UInt, dark: UInt) -> Color {
    Color(
      UIColor { traits in
        UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
      }
    )
  }
}

extension UIColor {
  fileprivate convenience init(hex: UInt) {
    self.init(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: 1
    )
  }
}
