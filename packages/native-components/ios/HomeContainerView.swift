import UIKit

final class HomeContainerView: UIView {
  private let contentStack = UIStackView()
  private let badgeLabel = UILabel()
  private let titleLabel = UILabel()
  private let subtitleLabel = UILabel()
  private let tabLabel = UILabel()
  private let portfolioCard = UIView()
  private let portfolioTitleLabel = UILabel()
  private let portfolioMessageLabel = UILabel()
  private let intentButton = UIButton(type: .system)
  private let ownerStatusLabel = UILabel()

  private var currentState: INativeHomeViewModel?
  private var onIntent: ((_ intent: INativeHomeDiagnosticIntent) -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    configureView()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(
    state: INativeHomeViewModel?,
    onIntent: ((_ intent: INativeHomeDiagnosticIntent) -> Void)?
  ) {
    dispatchPrecondition(condition: .onQueue(.main))
    currentState = state
    self.onIntent = onIntent

    guard let state else {
      intentButton.isEnabled = false
      return
    }

    let theme = state.theme
    backgroundColor = UIColor(homeHex: theme.backgroundColor, fallback: .systemBackground)
    portfolioCard.backgroundColor = UIColor(homeHex: theme.surfaceColor, fallback: .secondarySystemBackground)
    titleLabel.textColor = UIColor(homeHex: theme.primaryTextColor, fallback: .label)
    subtitleLabel.textColor = UIColor(homeHex: theme.secondaryTextColor, fallback: .secondaryLabel)
    tabLabel.textColor = UIColor(homeHex: theme.primaryTextColor, fallback: .label)
    portfolioTitleLabel.textColor = UIColor(homeHex: theme.primaryTextColor, fallback: .label)
    portfolioMessageLabel.textColor = UIColor(homeHex: theme.secondaryTextColor, fallback: .secondaryLabel)
    ownerStatusLabel.textColor = UIColor(homeHex: theme.secondaryTextColor, fallback: .secondaryLabel)
    intentButton.tintColor = UIColor(homeHex: theme.accentColor, fallback: .systemGreen)
    badgeLabel.textColor = UIColor(homeHex: theme.accentColor, fallback: .systemGreen)

    titleLabel.text = state.header.title
    subtitleLabel.text = state.header.subtitle
    tabLabel.text = state.tabs.first(where: { $0.id == state.selectedTab })?.title
    portfolioTitleLabel.text = state.portfolio.title
    portfolioMessageLabel.text = state.portfolio.message
    ownerStatusLabel.text = "Owner-scoped intent is ready"
    intentButton.isEnabled = onIntent != nil
  }

  func dispose() {
    currentState = nil
    onIntent = nil
    intentButton.isEnabled = false
  }

  private func configureView() {
    accessibilityIdentifier = "native-home-diagnostic"

    contentStack.axis = .vertical
    contentStack.spacing = 12
    contentStack.translatesAutoresizingMaskIntoConstraints = false
    addSubview(contentStack)

    badgeLabel.text = "NATIVE iOS DIAGNOSTIC"
    badgeLabel.font = .preferredFont(forTextStyle: .caption1)
    badgeLabel.adjustsFontForContentSizeCategory = true

    titleLabel.font = .preferredFont(forTextStyle: .largeTitle)
    titleLabel.adjustsFontForContentSizeCategory = true
    titleLabel.numberOfLines = 0

    subtitleLabel.font = .preferredFont(forTextStyle: .body)
    subtitleLabel.adjustsFontForContentSizeCategory = true
    subtitleLabel.numberOfLines = 0

    tabLabel.font = .preferredFont(forTextStyle: .headline)
    tabLabel.adjustsFontForContentSizeCategory = true

    portfolioCard.layer.cornerRadius = 16
    portfolioCard.translatesAutoresizingMaskIntoConstraints = false

    let portfolioStack = UIStackView(arrangedSubviews: [
      portfolioTitleLabel,
      portfolioMessageLabel,
      ownerStatusLabel,
      intentButton,
    ])
    portfolioStack.axis = .vertical
    portfolioStack.spacing = 10
    portfolioStack.translatesAutoresizingMaskIntoConstraints = false
    portfolioCard.addSubview(portfolioStack)

    portfolioTitleLabel.font = .preferredFont(forTextStyle: .title2)
    portfolioTitleLabel.adjustsFontForContentSizeCategory = true

    portfolioMessageLabel.font = .preferredFont(forTextStyle: .body)
    portfolioMessageLabel.adjustsFontForContentSizeCategory = true
    portfolioMessageLabel.numberOfLines = 0

    ownerStatusLabel.font = .preferredFont(forTextStyle: .footnote)
    ownerStatusLabel.adjustsFontForContentSizeCategory = true

    intentButton.setTitle("Verify owner-scoped round trip", for: .normal)
    intentButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
    intentButton.titleLabel?.adjustsFontForContentSizeCategory = true
    intentButton.accessibilityIdentifier = "native-home-diagnostic-roundtrip"
    intentButton.contentHorizontalAlignment = .leading
    intentButton.addTarget(self, action: #selector(handleIntentButton), for: .touchUpInside)

    contentStack.addArrangedSubview(badgeLabel)
    contentStack.addArrangedSubview(titleLabel)
    contentStack.addArrangedSubview(subtitleLabel)
    contentStack.setCustomSpacing(28, after: subtitleLabel)
    contentStack.addArrangedSubview(tabLabel)
    contentStack.addArrangedSubview(portfolioCard)

    NSLayoutConstraint.activate([
      contentStack.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor, constant: 24),
      contentStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
      contentStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
      portfolioStack.topAnchor.constraint(equalTo: portfolioCard.topAnchor, constant: 20),
      portfolioStack.leadingAnchor.constraint(equalTo: portfolioCard.leadingAnchor, constant: 20),
      portfolioStack.trailingAnchor.constraint(equalTo: portfolioCard.trailingAnchor, constant: -20),
      portfolioStack.bottomAnchor.constraint(equalTo: portfolioCard.bottomAnchor, constant: -20),
    ])
  }

  @objc
  private func handleIntentButton() {
    guard let owner = currentState?.owner else { return }
    onIntent?(INativeHomeDiagnosticIntent(owner: owner))
  }
}

private extension UIColor {
  convenience init(homeHex: String, fallback: UIColor) {
    let hex = homeHex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    guard hex.count == 6 || hex.count == 8 else {
      self.init(cgColor: fallback.cgColor)
      return
    }

    var value: UInt64 = 0
    guard Scanner(string: hex).scanHexInt64(&value) else {
      self.init(cgColor: fallback.cgColor)
      return
    }

    let red: CGFloat
    let green: CGFloat
    let blue: CGFloat
    let alpha: CGFloat
    if hex.count == 8 {
      red = CGFloat((value >> 24) & 0xFF) / 255
      green = CGFloat((value >> 16) & 0xFF) / 255
      blue = CGFloat((value >> 8) & 0xFF) / 255
      alpha = CGFloat(value & 0xFF) / 255
    } else {
      red = CGFloat((value >> 16) & 0xFF) / 255
      green = CGFloat((value >> 8) & 0xFF) / 255
      blue = CGFloat(value & 0xFF) / 255
      alpha = 1
    }
    self.init(red: red, green: green, blue: blue, alpha: alpha)
  }
}
