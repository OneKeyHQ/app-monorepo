import UIKit

// MARK: - i18n helper

private enum RecoveryStrings {
  static var isChinese: Bool {
    guard let lang = Locale.preferredLanguages.first else { return false }
    return lang.hasPrefix("zh")
  }

  static var title: String { isChinese ? "应用启动失败" : "App Failed to Start" }
  static var subtitle: String {
    isChinese
      ? "应用连续多次启动失败。\n请尝试以下操作来恢复。"
      : "The app has failed to start multiple times.\nPlease try the options below to recover."
  }
  static var exportLogs: String { isChinese ? "导出日志" : "Export Logs" }
  static var tryAgain: String { isChinese ? "重新尝试" : "Try Again" }
  static var autoRepair: String { isChinese ? "自动修复" : "Auto Repair" }
  static var tryAgainAlertTitle: String { isChinese ? "已重置" : "Reset Complete" }
  static var tryAgainAlertMessage: String { isChinese ? "请重新打开应用。" : "Please reopen the app." }
  static var autoRepairAlertTitle: String { isChinese ? "修复完成" : "Repair Complete" }
  static var autoRepairAlertMessage: String { "" }
  static var errorTitle: String { isChinese ? "操作失败" : "Operation Failed" }
  static var ok: String { isChinese ? "好的" : "OK" }
  static var noLogsFound: String { isChinese ? "未找到日志文件" : "No log files found" }
}

// MARK: - NitroModuleBridge for RecoveryViewController

private enum RecoveryNitroModuleBridge {
  /// Calls BundleUpdateStore.clearUpdateBundleData() via dynamic dispatch
  static func clearUpdateBundleData() {
    guard let cls = NSClassFromString("ReactNativeBundleUpdate.BundleUpdateStore") as? NSObject.Type else { return }
    cls.perform(NSSelectorFromString("clearUpdateBundleData"))
  }

  /// Returns the bundle directory path for OTA bundles
  static func bundleDir() -> String? {
    guard let cls = NSClassFromString("ReactNativeBundleUpdate.BundleUpdateStore") as? NSObject.Type else { return nil }
    return cls.perform(NSSelectorFromString("bundleDir"))?.takeUnretainedValue() as? String
  }

  /// Returns the download bundle directory path
  static func downloadBundleDir() -> String? {
    guard let cls = NSClassFromString("ReactNativeBundleUpdate.BundleUpdateStore") as? NSObject.Type else { return nil }
    return cls.perform(NSSelectorFromString("downloadBundleDir"))?.takeUnretainedValue() as? String
  }

  /// Returns the log directory path from OneKeyLog
  static func logsDirectory() -> String? {
    guard let cls = NSClassFromString("ReactNativeNativeLogger.OneKeyLog") as? NSObject.Type else { return nil }
    return cls.value(forKeyPath: "logsDirectory") as? String
  }
}

// MARK: - RecoveryViewController

final class RecoveryViewController: UIViewController {

  // MARK: - UI Elements

  private let logoContainerView: UIView = {
    let view = UIView()
    view.backgroundColor = UIColor(red: 0x44/255.0, green: 0xD6/255.0, blue: 0x2C/255.0, alpha: 1.0)
    view.translatesAutoresizingMaskIntoConstraints = false
    return view
  }()

  private let keyImageView: UIImageView = {
    let config = UIImage.SymbolConfiguration(pointSize: 32, weight: .medium)
    let image = UIImage(systemName: "key.fill", withConfiguration: config)
    let iv = UIImageView(image: image)
    iv.tintColor = .black
    iv.contentMode = .scaleAspectFit
    iv.translatesAutoresizingMaskIntoConstraints = false
    return iv
  }()

  private let titleLabel: UILabel = {
    let label = UILabel()
    label.text = RecoveryStrings.title
    label.font = UIFont.systemFont(ofSize: 24, weight: .bold)
    label.textColor = .white
    label.textAlignment = .center
    label.translatesAutoresizingMaskIntoConstraints = false
    return label
  }()

  private let subtitleLabel: UILabel = {
    let label = UILabel()
    label.text = RecoveryStrings.subtitle
    label.font = UIFont.systemFont(ofSize: 15, weight: .regular)
    label.textColor = UIColor(white: 0.6, alpha: 1.0)
    label.textAlignment = .center
    label.numberOfLines = 0
    label.translatesAutoresizingMaskIntoConstraints = false
    return label
  }()

  private lazy var exportLogsButton: UIButton = {
    makeButton(
      title: RecoveryStrings.exportLogs,
      backgroundColor: UIColor(red: 0x2C/255.0, green: 0x2C/255.0, blue: 0x2C/255.0, alpha: 1.0),
      titleColor: .white,
      action: #selector(exportLogsTapped)
    )
  }()

  private lazy var tryAgainButton: UIButton = {
    makeButton(
      title: RecoveryStrings.tryAgain,
      backgroundColor: UIColor(red: 0x2C/255.0, green: 0x2C/255.0, blue: 0x2C/255.0, alpha: 1.0),
      titleColor: .white,
      action: #selector(tryAgainTapped)
    )
  }()

  private lazy var autoRepairButton: UIButton = {
    makeButton(
      title: RecoveryStrings.autoRepair,
      backgroundColor: UIColor(red: 0x44/255.0, green: 0xD6/255.0, blue: 0x2C/255.0, alpha: 1.0),
      titleColor: .black,
      action: #selector(autoRepairTapped)
    )
  }()

  private let versionLabel: UILabel = {
    let label = UILabel()
    let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
    label.text = "v\(version)"
    label.font = UIFont.monospacedSystemFont(ofSize: 13, weight: .regular)
    label.textColor = UIColor(white: 0.4, alpha: 1.0)
    label.textAlignment = .center
    label.translatesAutoresizingMaskIntoConstraints = false
    return label
  }()

  // MARK: - Lifecycle

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0x0F/255.0, green: 0x0F/255.0, blue: 0x0F/255.0, alpha: 1.0)
    setupLayout()
  }

  override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

  // MARK: - Layout

  private func setupLayout() {
    let logoSize: CGFloat = 64
    logoContainerView.layer.cornerRadius = logoSize / 2
    logoContainerView.clipsToBounds = true

    view.addSubview(logoContainerView)
    logoContainerView.addSubview(keyImageView)
    view.addSubview(titleLabel)
    view.addSubview(subtitleLabel)
    view.addSubview(exportLogsButton)
    view.addSubview(tryAgainButton)
    view.addSubview(autoRepairButton)
    view.addSubview(versionLabel)

    let screenWidth = UIScreen.main.bounds.width
    let buttonWidth = min(screenWidth * 0.8, 320)

    NSLayoutConstraint.activate([
      // Logo
      logoContainerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      logoContainerView.widthAnchor.constraint(equalToConstant: logoSize),
      logoContainerView.heightAnchor.constraint(equalToConstant: logoSize),
      logoContainerView.bottomAnchor.constraint(equalTo: titleLabel.topAnchor, constant: -24),

      keyImageView.centerXAnchor.constraint(equalTo: logoContainerView.centerXAnchor),
      keyImageView.centerYAnchor.constraint(equalTo: logoContainerView.centerYAnchor),

      // Title
      titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      titleLabel.bottomAnchor.constraint(equalTo: subtitleLabel.topAnchor, constant: -12),

      // Subtitle
      subtitleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      subtitleLabel.bottomAnchor.constraint(equalTo: exportLogsButton.topAnchor, constant: -40),
      subtitleLabel.widthAnchor.constraint(lessThanOrEqualToConstant: buttonWidth),

      // Export Logs Button
      exportLogsButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      exportLogsButton.widthAnchor.constraint(equalToConstant: buttonWidth),
      exportLogsButton.heightAnchor.constraint(equalToConstant: 48),
      exportLogsButton.bottomAnchor.constraint(equalTo: tryAgainButton.topAnchor, constant: -12),

      // Try Again Button
      tryAgainButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      tryAgainButton.widthAnchor.constraint(equalToConstant: buttonWidth),
      tryAgainButton.heightAnchor.constraint(equalToConstant: 48),
      tryAgainButton.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: 60),

      // Auto Repair Button
      autoRepairButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      autoRepairButton.widthAnchor.constraint(equalToConstant: buttonWidth),
      autoRepairButton.heightAnchor.constraint(equalToConstant: 48),
      autoRepairButton.topAnchor.constraint(equalTo: tryAgainButton.bottomAnchor, constant: 12),

      // Version Label
      versionLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      versionLabel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
    ])
  }

  // MARK: - Button Factory

  private func makeButton(title: String, backgroundColor: UIColor, titleColor: UIColor, action: Selector) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.setTitleColor(titleColor, for: .normal)
    button.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
    button.backgroundColor = backgroundColor
    button.layer.cornerRadius = 12
    button.clipsToBounds = true
    button.translatesAutoresizingMaskIntoConstraints = false
    button.addTarget(self, action: action, for: .touchUpInside)
    return button
  }

  // MARK: - Actions

  @objc private func exportLogsTapped() {
    do {
      let logDir = logDirectory()
      let fm = FileManager.default

      guard fm.fileExists(atPath: logDir) else {
        showAlert(title: RecoveryStrings.errorTitle, message: RecoveryStrings.noLogsFound)
        return
      }

      let logFiles = try fm.contentsOfDirectory(atPath: logDir).filter { $0.hasSuffix(".log") }
      guard !logFiles.isEmpty else {
        showAlert(title: RecoveryStrings.errorTitle, message: RecoveryStrings.noLogsFound)
        return
      }

      let zipPath = NSTemporaryDirectory().appending("onekey-logs.zip")
      // Remove old zip if exists
      if fm.fileExists(atPath: zipPath) {
        try fm.removeItem(atPath: zipPath)
      }

      let success = createZip(atPath: zipPath, withFilesInDirectory: logDir, fileNames: logFiles)
      guard success else {
        showAlert(title: RecoveryStrings.errorTitle, message: "Failed to create log archive.")
        return
      }

      let zipURL = URL(fileURLWithPath: zipPath)
      let activityVC = UIActivityViewController(activityItems: [zipURL], applicationActivities: nil)
      activityVC.popoverPresentationController?.sourceView = exportLogsButton
      activityVC.popoverPresentationController?.sourceRect = exportLogsButton.bounds
      present(activityVC, animated: true)
    } catch {
      showAlert(title: RecoveryStrings.errorTitle, message: error.localizedDescription)
    }
  }

  @objc private func tryAgainTapped() {
    let defaults = UserDefaults.standard
    defaults.set(0, forKey: "onekey_consecutive_boot_fail_count")
    defaults.set("try_again", forKey: "onekey_recovery_action")
    defaults.synchronize()
    showAlert(title: RecoveryStrings.tryAgainAlertTitle, message: RecoveryStrings.tryAgainAlertMessage)
  }

  @objc private func autoRepairTapped() {
    var errors: [String] = []

    // 1. Clear BundleUpdateStore data via NitroModuleBridge pattern
    RecoveryNitroModuleBridge.clearUpdateBundleData()

    // 2. Delete OTA bundle directories manually as a safety net
    let fm = FileManager.default
    let docDir = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true).first ?? ""

    let bundleDir = (docDir as NSString).appendingPathComponent("onekey-bundle")
    if fm.fileExists(atPath: bundleDir) {
      do {
        try fm.removeItem(atPath: bundleDir)
      } catch {
        errors.append("Remove bundle dir: \(error.localizedDescription)")
      }
    }

    let downloadDir = (docDir as NSString).appendingPathComponent("onekey-bundle-download")
    if fm.fileExists(atPath: downloadDir) {
      do {
        try fm.removeItem(atPath: downloadDir)
      } catch {
        errors.append("Remove download dir: \(error.localizedDescription)")
      }
    }

    // 3. Reset boot fail counter
    let defaults = UserDefaults.standard
    defaults.set(0, forKey: "onekey_consecutive_boot_fail_count")
    defaults.set("auto_repair", forKey: "onekey_recovery_action")
    defaults.synchronize()

    if errors.isEmpty {
      showAlert(title: RecoveryStrings.autoRepairAlertTitle, message: RecoveryStrings.autoRepairAlertMessage)
    } else {
      let detail = errors.joined(separator: "\n")
      showAlert(title: RecoveryStrings.errorTitle, message: detail)
    }
  }

  // MARK: - Helpers

  private func logDirectory() -> String {
    // Use OneKeyLog API via NitroModuleBridge to get the actual log directory
    if let logDir = RecoveryNitroModuleBridge.logsDirectory(), !logDir.isEmpty {
      return logDir
    }
    // Fallback: match OneKeyLog.logsDirectory default (Caches/logs)
    let cacheDir = NSSearchPathForDirectoriesInDomains(.cachesDirectory, .userDomainMask, true).first ?? NSTemporaryDirectory()
    return (cacheDir as NSString).appendingPathComponent("logs")
  }

  /// Creates a zip archive of the given files using NSFileCoordinator (forUploading).
  /// This produces a valid .zip without any third-party library.
  private func createZip(atPath zipPath: String, withFilesInDirectory directory: String, fileNames: [String]) -> Bool {
    let fm = FileManager.default
    let stagingDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("onekey-log-staging")

    // Prepare a clean staging directory
    if fm.fileExists(atPath: stagingDir) {
      try? fm.removeItem(atPath: stagingDir)
    }
    try? fm.createDirectory(atPath: stagingDir, withIntermediateDirectories: true)

    for name in fileNames {
      let src = (directory as NSString).appendingPathComponent(name)
      let dst = (stagingDir as NSString).appendingPathComponent(name)
      try? fm.copyItem(atPath: src, toPath: dst)
    }

    let sourceURL = URL(fileURLWithPath: stagingDir)
    let destURL = URL(fileURLWithPath: zipPath)

    // NSFileCoordinator with .forUploading on a directory produces a zip archive
    let coordinator = NSFileCoordinator()
    var zipCreated = false
    var coordinatorError: NSError?

    coordinator.coordinate(readingItemAt: sourceURL, options: .forUploading, error: &coordinatorError) { tempURL in
      do {
        if fm.fileExists(atPath: zipPath) {
          try fm.removeItem(atPath: zipPath)
        }
        try fm.moveItem(at: tempURL, to: destURL)
        zipCreated = true
      } catch {
        // zip move failed
      }
    }

    try? fm.removeItem(atPath: stagingDir)
    return zipCreated && coordinatorError == nil
  }

  private func showAlert(title: String, message: String) {
    let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: RecoveryStrings.ok, style: .default))
    present(alert, animated: true)
  }
}
