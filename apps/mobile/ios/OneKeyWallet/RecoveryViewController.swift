import UIKit
import MMKV

// MARK: - i18n helper

private struct RecoveryLocale {
  let title: String
  let subtitle: String
  let exportLogs: String
  let tryAgain: String
  let autoRepair: String
  let repairComplete: String
  let pleaseRestart: String
  let error: String
  let ok: String
  let exportError: String
  let repairError: String
  let noLogs: String
}

private enum RecoveryStrings {
  static let localeMap: [String: RecoveryLocale] = [
    "en": RecoveryLocale(
      title: "We hit a snag",
      subtitle: "It looks like the app had trouble starting.\nA quick fix should get things back to normal.",
      exportLogs: "Export Logs", tryAgain: "Not Now", autoRepair: "Quick Fix",
      repairComplete: "Repair Complete", pleaseRestart: "Please reopen the app", error: "Error", ok: "OK",
      exportError: "Failed to export logs", repairError: "Repair failed", noLogs: "No log files found"),
    "zh-CN": RecoveryLocale(
      title: "遇到了一点问题",
      subtitle: "应用似乎未能正常启动，\n快速修复一下试试？",
      exportLogs: "导出日志", tryAgain: "暂不修复", autoRepair: "快速修复",
      repairComplete: "修复完成", pleaseRestart: "请重新打开应用", error: "错误", ok: "确定",
      exportError: "导出日志失败", repairError: "修复失败", noLogs: "未找到日志文件"),
    // Traditional Chinese — shared by zh-TW, zh-HK, zh-Hant
    "zh-Hant": RecoveryLocale(
      title: "遇到了一點問題",
      subtitle: "應用程式似乎未能正常啟動，\n快速修復一下試試？",
      exportLogs: "匯出日誌", tryAgain: "暫不修復", autoRepair: "快速修復",
      repairComplete: "修復完成", pleaseRestart: "請重新打開應用程式", error: "錯誤", ok: "確定",
      exportError: "匯出日誌失敗", repairError: "修復失敗", noLogs: "未找到日誌檔案"),
    "ja-JP": RecoveryLocale(
      title: "問題が発生しました",
      subtitle: "アプリの起動がうまくいかなかったようです。\nクイック修復をお試しください。",
      exportLogs: "ログを書き出す", tryAgain: "今はしない", autoRepair: "クイック修復",
      repairComplete: "修復完了", pleaseRestart: "アプリを再起動してください", error: "エラー", ok: "OK",
      exportError: "ログの書き出しに失敗しました", repairError: "修復に失敗しました", noLogs: "ログファイルが見つかりません"),
    "ko-KR": RecoveryLocale(
      title: "문제가 발생했어요",
      subtitle: "앱이 정상적으로 시작되지 않은 것 같아요.\n빠른 수리를 시도해 보세요.",
      exportLogs: "로그 내보내기", tryAgain: "나중에", autoRepair: "빠른 수리",
      repairComplete: "복구 완료", pleaseRestart: "앱을 다시 열어주세요", error: "오류", ok: "확인",
      exportError: "로그 내보내기 실패", repairError: "복구 실패", noLogs: "로그 파일을 찾을 수 없습니다"),
    "de": RecoveryLocale(
      title: "Ein kleines Problem",
      subtitle: "Die App scheint nicht richtig gestartet zu sein.\nEine Schnellreparatur sollte helfen.",
      exportLogs: "Protokolle exportieren", tryAgain: "Nicht jetzt", autoRepair: "Schnellreparatur",
      repairComplete: "Reparatur abgeschlossen", pleaseRestart: "Bitte starten Sie die App neu", error: "Fehler", ok: "OK",
      exportError: "Protokollexport fehlgeschlagen", repairError: "Reparatur fehlgeschlagen", noLogs: "Keine Protokolldateien gefunden"),
    "es": RecoveryLocale(
      title: "Algo no salió bien",
      subtitle: "Parece que la aplicación tuvo problemas al iniciarse.\nUna reparación rápida debería solucionarlo.",
      exportLogs: "Exportar registros", tryAgain: "Ahora no", autoRepair: "Reparación rápida",
      repairComplete: "Reparación completada", pleaseRestart: "Por favor, vuelva a abrir la aplicación", error: "Error", ok: "OK",
      exportError: "Error al exportar registros", repairError: "Reparación fallida", noLogs: "No se encontraron archivos de registro"),
    "fr-FR": RecoveryLocale(
      title: "Un petit souci",
      subtitle: "L'application semble avoir eu du mal à démarrer.\nUne réparation rapide devrait arranger les choses.",
      exportLogs: "Exporter les journaux", tryAgain: "Pas maintenant", autoRepair: "Réparation rapide",
      repairComplete: "Réparation terminée", pleaseRestart: "Veuillez rouvrir l'application", error: "Erreur", ok: "OK",
      exportError: "Échec de l'exportation des journaux", repairError: "Échec de la réparation", noLogs: "Aucun fichier journal trouvé"),
    "it-IT": RecoveryLocale(
      title: "Un piccolo problema",
      subtitle: "Sembra che l'app abbia avuto difficoltà ad avviarsi.\nUna riparazione rapida dovrebbe risolvere.",
      exportLogs: "Esporta log", tryAgain: "Non ora", autoRepair: "Riparazione rapida",
      repairComplete: "Riparazione completata", pleaseRestart: "Si prega di riaprire l'app", error: "Errore", ok: "OK",
      exportError: "Esportazione log non riuscita", repairError: "Riparazione non riuscita", noLogs: "Nessun file di log trovato"),
    "pt": RecoveryLocale(
      title: "Um pequeno problema",
      subtitle: "A aplicação parece ter tido dificuldades ao iniciar.\nUma reparação rápida deverá resolver.",
      exportLogs: "Exportar registos", tryAgain: "Agora não", autoRepair: "Reparação rápida",
      repairComplete: "Reparação concluída", pleaseRestart: "Por favor, reabra a aplicação", error: "Erro", ok: "OK",
      exportError: "Falha ao exportar registos", repairError: "Falha na reparação", noLogs: "Nenhum ficheiro de registo encontrado"),
    "pt-BR": RecoveryLocale(
      title: "Um pequeno problema",
      subtitle: "O aplicativo parece ter tido dificuldades ao iniciar.\nUma correção rápida deve resolver.",
      exportLogs: "Exportar logs", tryAgain: "Agora não", autoRepair: "Correção rápida",
      repairComplete: "Reparo concluído", pleaseRestart: "Por favor, reabra o aplicativo", error: "Erro", ok: "OK",
      exportError: "Falha ao exportar logs", repairError: "Falha no reparo", noLogs: "Nenhum arquivo de log encontrado"),
    "ru": RecoveryLocale(
      title: "Небольшая проблема",
      subtitle: "Похоже, приложение не смогло нормально запуститься.\nБыстрое исправление должно помочь.",
      exportLogs: "Экспорт журналов", tryAgain: "Не сейчас", autoRepair: "Быстрое исправление",
      repairComplete: "Восстановление завершено", pleaseRestart: "Пожалуйста, откройте приложение заново", error: "Ошибка", ok: "OK",
      exportError: "Не удалось экспортировать журналы", repairError: "Не удалось выполнить восстановление", noLogs: "Файлы журналов не найдены"),
    "bn": RecoveryLocale(
      title: "একটু সমস্যা হয়েছে",
      subtitle: "অ্যাপটি সঠিকভাবে চালু হতে পারেনি বলে মনে হচ্ছে।\nদ্রুত মেরামত করে দেখুন।",
      exportLogs: "লগ রপ্তানি", tryAgain: "এখন নয়", autoRepair: "দ্রুত মেরামত",
      repairComplete: "মেরামত সম্পন্ন", pleaseRestart: "অনুগ্রহ করে অ্যাপটি পুনরায় খুলুন", error: "ত্রুটি", ok: "ঠিক আছে",
      exportError: "লগ রপ্তানি ব্যর্থ", repairError: "মেরামত ব্যর্থ", noLogs: "কোনো লগ ফাইল পাওয়া যায়নি"),
    "hi-IN": RecoveryLocale(
      title: "एक छोटी सी समस्या",
      subtitle: "ऐप सही से शुरू नहीं हो पाया लगता है।\nत्वरित मरम्मत से ठीक हो जाना चाहिए।",
      exportLogs: "लॉग निर्यात करें", tryAgain: "अभी नहीं", autoRepair: "त्वरित मरम्मत",
      repairComplete: "मरम्मत पूर्ण", pleaseRestart: "कृपया ऐप को पुनः खोलें", error: "त्रुटि", ok: "ठीक है",
      exportError: "लॉग निर्यात विफल", repairError: "मरम्मत विफल", noLogs: "कोई लॉग फ़ाइल नहीं मिली"),
    "id": RecoveryLocale(
      title: "Ada sedikit masalah",
      subtitle: "Sepertinya aplikasi mengalami kendala saat memulai.\nPerbaikan cepat seharusnya bisa mengatasinya.",
      exportLogs: "Ekspor log", tryAgain: "Nanti saja", autoRepair: "Perbaikan cepat",
      repairComplete: "Perbaikan selesai", pleaseRestart: "Silakan buka ulang aplikasi", error: "Kesalahan", ok: "OK",
      exportError: "Gagal mengekspor log", repairError: "Perbaikan gagal", noLogs: "File log tidak ditemukan"),
    "th-TH": RecoveryLocale(
      title: "พบปัญหาเล็กน้อย",
      subtitle: "ดูเหมือนแอปเริ่มต้นไม่สำเร็จ\nการซ่อมแซมด่วนน่าจะช่วยได้",
      exportLogs: "ส่งออกบันทึก", tryAgain: "ไว้ทีหลัง", autoRepair: "ซ่อมแซมด่วน",
      repairComplete: "ซ่อมแซมเสร็จสิ้น", pleaseRestart: "กรุณาเปิดแอปใหม่", error: "ข้อผิดพลาด", ok: "ตกลง",
      exportError: "ส่งออกบันทึกไม่สำเร็จ", repairError: "ซ่อมแซมไม่สำเร็จ", noLogs: "ไม่พบไฟล์บันทึก"),
    "uk-UA": RecoveryLocale(
      title: "Невелика проблема",
      subtitle: "Схоже, додаток не зміг нормально запуститися.\nШвидке виправлення має допомогти.",
      exportLogs: "Експорт журналів", tryAgain: "Не зараз", autoRepair: "Швидке виправлення",
      repairComplete: "Відновлення завершено", pleaseRestart: "Будь ласка, відкрийте додаток заново", error: "Помилка", ok: "OK",
      exportError: "Не вдалося експортувати журнали", repairError: "Не вдалося виконати відновлення", noLogs: "Файли журналів не знайдено"),
    "vi": RecoveryLocale(
      title: "Gặp chút trục trặc",
      subtitle: "Có vẻ ứng dụng gặp khó khăn khi khởi động.\nSửa nhanh sẽ giúp mọi thứ trở lại bình thường.",
      exportLogs: "Xuất nhật ký", tryAgain: "Để sau", autoRepair: "Sửa nhanh",
      repairComplete: "Sửa chữa hoàn tất", pleaseRestart: "Vui lòng mở lại ứng dụng", error: "Lỗi", ok: "OK",
      exportError: "Xuất nhật ký thất bại", repairError: "Sửa chữa thất bại", noLogs: "Không tìm thấy tệp nhật ký"),
  ]

  // Script-to-region mapping for CJK script subtags.
  // iOS uses BCP 47 script subtags for Chinese variants in Locale.preferredLanguages:
  //   - Simplified Chinese → "zh-Hans" or "zh-Hans-CN"
  //   - Traditional Chinese (TW) → "zh-Hant" or "zh-Hant-TW"
  //   - Traditional Chinese (HK) → "zh-Hant-HK"
  // Our i18n keys use region codes (zh-CN, zh-TW, zh-HK), so we map:
  //   Hans → zh-CN, Hant → zh-Hant (Traditional Chinese, shared by TW/HK)
  private static let scriptMap: [String: String] = ["Hans": "zh-CN", "Hant": "zh-Hant"]

  // Aliases: zh-TW and zh-HK both map to zh-Hant (Traditional Chinese)
  private static let aliasMap: [String: String] = ["zh-TW": "zh-Hant", "zh-HK": "zh-Hant"]

  // Locale matching priority:
  //   1. Exact match (e.g. "ja-JP", "de")
  //   2. Alias mapping (e.g. "zh-TW" → "zh-Hant", "zh-HK" → "zh-Hant")
  //   3. Script subtag mapping (e.g. "zh-Hans" → "zh-CN", "zh-Hant" → "zh-Hant")
  //   4. First-last parts (e.g. "zh-Hans-CN" → "zh-CN")
  //   4. Prefix match (e.g. "fr" → "fr-FR", "ja" → "ja-JP")
  //   5. Fallback to "en"
  static var current: RecoveryLocale {
    guard let lang = Locale.preferredLanguages.first else { return localeMap["en"]! }
    // Exact match (e.g. "ja-JP", "de", "zh-Hant")
    if let exact = localeMap[lang] { return exact }
    // Alias match (e.g. "zh-TW" → "zh-Hant", "zh-HK" → "zh-Hant")
    if let aliased = aliasMap[lang], let match = localeMap[aliased] { return match }
    let parts = lang.split(separator: "-").map(String.init)
    // Script subtag mapping (e.g. "zh-Hans" → "zh-CN", "zh-Hant" → "zh-TW")
    if parts.count >= 2 {
      for (script, mapped) in scriptMap {
        if parts.contains(script), let match = localeMap[mapped] { return match }
      }
    }
    // First-last parts (e.g. "zh-Hant-HK" → "zh-HK", "zh-Hans-CN" → "zh-CN")
    if parts.count >= 2 {
      let twoPartKey = "\(parts[0])-\(parts[parts.count - 1])"
      if let match = localeMap[twoPartKey] { return match }
    }
    // Prefix match (e.g. "fr" → "fr-FR")
    let code = parts[0]
    if let match = localeMap[code] { return match }
    if let prefixMatch = localeMap.first(where: { $0.key.hasPrefix("\(code)-") })?.value { return prefixMatch }
    return localeMap["en"]!
  }
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

  /// Clears recovery-related keys from MMKV storage
  static func clearMmkvRecoveryKeys() {
    MMKV.initialize(rootDir: nil)
    guard let mmkv = MMKV(mmapID: "onekey-app-setting") else { return }
    mmkv.removeValue(forKey: "onekey_pending_install_task")
    mmkv.removeValue(forKey: "onekey_whats_new_shown")
    mmkv.removeValue(forKey: "last_valid_server_time")
    mmkv.removeValue(forKey: "last_valid_local_time")
  }
}

// MARK: - RecoveryViewController

final class RecoveryViewController: UIViewController {

  // MARK: - UI Elements

  private let logoImageView: UIImageView = {
    let iv = UIImageView()
    // Use the app icon from the asset catalog
    if let appIcon = UIImage(named: "AppIcon") {
      iv.image = appIcon
    } else {
      // Fallback: try to load from bundle info
      if let icons = Bundle.main.infoDictionary?["CFBundleIcons"] as? [String: Any],
         let primary = icons["CFBundlePrimaryIcon"] as? [String: Any],
         let files = primary["CFBundleIconFiles"] as? [String],
         let lastIcon = files.last {
        iv.image = UIImage(named: lastIcon)
      }
    }
    iv.contentMode = .scaleAspectFit
    iv.layer.cornerRadius = 16
    iv.clipsToBounds = true
    iv.translatesAutoresizingMaskIntoConstraints = false
    return iv
  }()

  private let titleLabel: UILabel = {
    let label = UILabel()
    label.text = RecoveryStrings.current.title
    label.font = UIFont.systemFont(ofSize: 24, weight: .bold)
    label.textColor = .white
    label.textAlignment = .center
    label.translatesAutoresizingMaskIntoConstraints = false
    return label
  }()

  private let subtitleLabel: UILabel = {
    let label = UILabel()
    label.text = RecoveryStrings.current.subtitle
    label.font = UIFont.systemFont(ofSize: 15, weight: .regular)
    label.textColor = UIColor(white: 0.6, alpha: 1.0)
    label.textAlignment = .center
    label.numberOfLines = 0
    label.translatesAutoresizingMaskIntoConstraints = false
    return label
  }()

  private lazy var autoRepairButton: UIButton = {
    makeButton(
      title: RecoveryStrings.current.autoRepair,
      backgroundColor: UIColor(red: 0x44/255.0, green: 0xD6/255.0, blue: 0x2C/255.0, alpha: 1.0),
      titleColor: .black,
      action: #selector(autoRepairTapped)
    )
  }()

  private lazy var tryAgainButton: UIButton = {
    makeButton(
      title: RecoveryStrings.current.tryAgain,
      backgroundColor: UIColor(red: 0x2C/255.0, green: 0x2C/255.0, blue: 0x2C/255.0, alpha: 1.0),
      titleColor: .white,
      action: #selector(tryAgainTapped)
    )
  }()

  private lazy var exportLogsButton: UIButton = {
    let button = UIButton(type: .system)
    button.setTitle(RecoveryStrings.current.exportLogs + " \u{203A}", for: .normal)
    button.setTitleColor(UIColor(white: 0.55, alpha: 1.0), for: .normal)
    button.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .regular)
    button.backgroundColor = .clear
    button.translatesAutoresizingMaskIntoConstraints = false
    button.addTarget(self, action: #selector(exportLogsTapped), for: .touchUpInside)
    return button
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

  private let separatorLabel: UILabel = {
    let label = UILabel()
    label.text = "\u{00B7}"
    label.font = UIFont.systemFont(ofSize: 12, weight: .regular)
    label.textColor = UIColor(white: 0.27, alpha: 1.0)
    label.translatesAutoresizingMaskIntoConstraints = false
    return label
  }()

  private func setupLayout() {
    let logoSize: CGFloat = 64

    view.addSubview(logoImageView)
    view.addSubview(titleLabel)
    view.addSubview(subtitleLabel)
    view.addSubview(autoRepairButton)
    view.addSubview(tryAgainButton)

    // Bottom bar: Export Logs · v6.1.0
    let bottomBar = UIStackView(arrangedSubviews: [versionLabel, separatorLabel, exportLogsButton])
    bottomBar.axis = .horizontal
    bottomBar.spacing = 6
    bottomBar.alignment = .center
    bottomBar.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(bottomBar)

    let screenWidth = UIScreen.main.bounds.width
    let buttonWidth = min(screenWidth * 0.8, 320)

    NSLayoutConstraint.activate([
      // Logo (App Icon)
      logoImageView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      logoImageView.widthAnchor.constraint(equalToConstant: logoSize),
      logoImageView.heightAnchor.constraint(equalToConstant: logoSize),
      logoImageView.bottomAnchor.constraint(equalTo: titleLabel.topAnchor, constant: -24),

      // Title
      titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      titleLabel.bottomAnchor.constraint(equalTo: subtitleLabel.topAnchor, constant: -12),

      // Subtitle
      subtitleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      subtitleLabel.bottomAnchor.constraint(equalTo: autoRepairButton.topAnchor, constant: -40),
      subtitleLabel.widthAnchor.constraint(lessThanOrEqualToConstant: buttonWidth),

      // Auto Repair Button (Primary - on top)
      autoRepairButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      autoRepairButton.widthAnchor.constraint(equalToConstant: buttonWidth),
      autoRepairButton.heightAnchor.constraint(equalToConstant: 48),
      autoRepairButton.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: 36),

      // Try Again Button (Secondary)
      tryAgainButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      tryAgainButton.widthAnchor.constraint(equalToConstant: buttonWidth),
      tryAgainButton.heightAnchor.constraint(equalToConstant: 48),
      tryAgainButton.topAnchor.constraint(equalTo: autoRepairButton.bottomAnchor, constant: 12),

      // Bottom bar
      bottomBar.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      bottomBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
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
        showAlert(title: RecoveryStrings.current.error, message: RecoveryStrings.current.noLogs)
        return
      }

      let logFiles = try fm.contentsOfDirectory(atPath: logDir).filter { $0.hasSuffix(".log") }
      guard !logFiles.isEmpty else {
        showAlert(title: RecoveryStrings.current.error, message: RecoveryStrings.current.noLogs)
        return
      }

      let zipPath = NSTemporaryDirectory().appending("onekey-logs.zip")
      // Remove old zip if exists
      if fm.fileExists(atPath: zipPath) {
        try fm.removeItem(atPath: zipPath)
      }

      let success = createZip(atPath: zipPath, withFilesInDirectory: logDir, fileNames: logFiles)
      guard success else {
        showAlert(title: RecoveryStrings.current.error, message: "Failed to create log archive.")
        return
      }

      let zipURL = URL(fileURLWithPath: zipPath)
      let activityVC = UIActivityViewController(activityItems: [zipURL], applicationActivities: nil)
      activityVC.popoverPresentationController?.sourceView = exportLogsButton
      activityVC.popoverPresentationController?.sourceRect = exportLogsButton.bounds
      present(activityVC, animated: true)
    } catch {
      showAlert(title: RecoveryStrings.current.error, message: error.localizedDescription)
    }
  }

  @objc private func tryAgainTapped() {
    let defaults = UserDefaults.standard
    defaults.set(0, forKey: BootRecoveryKeys.consecutiveBootFailCount)
    defaults.set("try_again", forKey: BootRecoveryKeys.recoveryAction)
    defaults.synchronize()
    showAlert(title: RecoveryStrings.current.pleaseRestart, message: "")
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

    // 3. Clear recovery-related keys from MMKV
    RecoveryNitroModuleBridge.clearMmkvRecoveryKeys()

    // 4. Reset boot fail counter
    let defaults = UserDefaults.standard
    defaults.set(0, forKey: BootRecoveryKeys.consecutiveBootFailCount)
    defaults.set("auto_repair", forKey: BootRecoveryKeys.recoveryAction)
    defaults.synchronize()

    if errors.isEmpty {
      showAlert(title: RecoveryStrings.current.repairComplete, message: "")
    } else {
      let detail = errors.joined(separator: "\n")
      showAlert(title: RecoveryStrings.current.error, message: detail)
    }
  }

  // MARK: - Helpers

  private func logDirectory() -> String {
    // Match OneKeyLog.logsDirectory path: Caches/logs
    // Cannot use NitroModuleBridge here because RN/Nitro modules are not initialized
    // in recovery mode (super.application() is skipped).
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
    alert.addAction(UIAlertAction(title: RecoveryStrings.current.ok, style: .default))
    present(alert, animated: true)
  }
}
