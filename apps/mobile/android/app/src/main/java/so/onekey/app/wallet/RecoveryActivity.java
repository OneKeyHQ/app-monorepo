package so.onekey.app.wallet;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Process;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid;
import com.tencent.mmkv.MMKV;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class RecoveryActivity extends AppCompatActivity {

    // i18n locale strings
    private String sTitle, sSubtitle, sExportLogs, sTryAgain, sAutoRepair;
    private String sRepairComplete, sError, sOk, sExportError, sRepairError, sNoLogs;

    private static final java.util.Map<String, String[]> LOCALE_MAP = new java.util.LinkedHashMap<>();
    static {
        // Order: title, subtitle, exportLogs, tryAgain, autoRepair, repairComplete, error, ok, exportError, repairError, noLogs
        LOCALE_MAP.put("en", new String[]{"App Failed to Start", "The app has failed to start multiple times. You can try the following options to resolve the issue.", "Export Logs", "Try Again", "Auto Repair", "Repair Complete", "Error", "OK", "Failed to export logs", "Repair failed", "No log files found"});
        LOCALE_MAP.put("zh-CN", new String[]{"应用启动失败", "应用已多次启动失败。您可以尝试以下选项来解决问题。", "导出日志", "重试", "自动修复", "修复完成", "错误", "确定", "导出日志失败", "修复失败", "未找到日志文件"});
        // Traditional Chinese — shared by zh-TW, zh-HK, zh-Hant
        LOCALE_MAP.put("zh-Hant", new String[]{"應用程式啟動失敗", "應用程式已多次啟動失敗。您可以嘗試以下選項來解決問題。", "匯出日誌", "重試", "自動修復", "修復完成", "錯誤", "確定", "匯出日誌失敗", "修復失敗", "未找到日誌檔案"});
        LOCALE_MAP.put("ja-JP", new String[]{"アプリの起動に失敗しました", "アプリが複数回起動に失敗しました。以下のオプションをお試しください。", "ログを書き出す", "再試行", "自動修復", "修復完了", "エラー", "OK", "ログの書き出しに失敗しました", "修復に失敗しました", "ログファイルが見つかりません"});
        LOCALE_MAP.put("ko-KR", new String[]{"앱 시작 실패", "앱이 여러 번 시작에 실패했습니다. 아래 옵션을 시도해 보세요.", "로그 내보내기", "다시 시도", "자동 복구", "복구 완료", "오류", "확인", "로그 내보내기 실패", "복구 실패", "로그 파일을 찾을 수 없습니다"});
        LOCALE_MAP.put("de", new String[]{"App konnte nicht gestartet werden", "Die App konnte mehrfach nicht gestartet werden. Bitte versuchen Sie die folgenden Optionen.", "Protokolle exportieren", "Erneut versuchen", "Automatische Reparatur", "Reparatur abgeschlossen", "Fehler", "OK", "Protokollexport fehlgeschlagen", "Reparatur fehlgeschlagen", "Keine Protokolldateien gefunden"});
        LOCALE_MAP.put("es", new String[]{"La aplicación no pudo iniciarse", "La aplicación no pudo iniciarse varias veces. Puede intentar las siguientes opciones.", "Exportar registros", "Reintentar", "Reparación automática", "Reparación completada", "Error", "OK", "Error al exportar registros", "Reparación fallida", "No se encontraron archivos de registro"});
        LOCALE_MAP.put("fr-FR", new String[]{"Échec du lancement de l'application", "L'application n'a pas pu démarrer plusieurs fois. Veuillez essayer les options suivantes.", "Exporter les journaux", "Réessayer", "Réparation automatique", "Réparation terminée", "Erreur", "OK", "Échec de l'exportation des journaux", "Échec de la réparation", "Aucun fichier journal trouvé"});
        LOCALE_MAP.put("it-IT", new String[]{"Avvio dell'app non riuscito", "L'app non è riuscita ad avviarsi più volte. Prova le seguenti opzioni.", "Esporta log", "Riprova", "Riparazione automatica", "Riparazione completata", "Errore", "OK", "Esportazione log non riuscita", "Riparazione non riuscita", "Nessun file di log trovato"});
        LOCALE_MAP.put("pt", new String[]{"Falha ao iniciar a aplicação", "A aplicação falhou ao iniciar várias vezes. Tente as seguintes opções.", "Exportar registos", "Tentar novamente", "Reparação automática", "Reparação concluída", "Erro", "OK", "Falha ao exportar registos", "Falha na reparação", "Nenhum ficheiro de registo encontrado"});
        LOCALE_MAP.put("pt-BR", new String[]{"Falha ao iniciar o aplicativo", "O aplicativo falhou ao iniciar várias vezes. Tente as seguintes opções.", "Exportar logs", "Tentar novamente", "Reparo automático", "Reparo concluído", "Erro", "OK", "Falha ao exportar logs", "Falha no reparo", "Nenhum arquivo de log encontrado"});
        LOCALE_MAP.put("ru", new String[]{"Не удалось запустить приложение", "Приложение не удалось запустить несколько раз. Попробуйте следующие варианты.", "Экспорт журналов", "Повторить", "Автовосстановление", "Восстановление завершено", "Ошибка", "OK", "Не удалось экспортировать журналы", "Не удалось выполнить восстановление", "Файлы журналов не найдены"});
        LOCALE_MAP.put("bn", new String[]{"অ্যাপ চালু করতে ব্যর্থ", "অ্যাপটি একাধিকবার চালু করতে ব্যর্থ হয়েছে। অনুগ্রহ করে নিম্নলিখিত বিকল্পগুলি চেষ্টা করুন।", "লগ রপ্তানি", "পুনরায় চেষ্টা", "স্বয়ংক্রিয় মেরামত", "মেরামত সম্পন্ন", "ত্রুটি", "ঠিক আছে", "লগ রপ্তানি ব্যর্থ", "মেরামত ব্যর্থ", "কোনো লগ ফাইল পাওয়া যায়নি"});
        LOCALE_MAP.put("hi-IN", new String[]{"ऐप प्रारंभ करने में विफल", "ऐप कई बार प्रारंभ होने में विफल रहा है। कृपया निम्नलिखित विकल्प आज़माएँ।", "लॉग निर्यात करें", "पुनः प्रयास करें", "स्वतः मरम्मत", "मरम्मत पूर्ण", "त्रुटि", "ठीक है", "लॉग निर्यात विफल", "मरम्मत विफल", "कोई लॉग फ़ाइल नहीं मिली"});
        LOCALE_MAP.put("id", new String[]{"Aplikasi gagal dimulai", "Aplikasi gagal dimulai beberapa kali. Silakan coba opsi berikut.", "Ekspor log", "Coba lagi", "Perbaikan otomatis", "Perbaikan selesai", "Kesalahan", "OK", "Gagal mengekspor log", "Perbaikan gagal", "File log tidak ditemukan"});
        LOCALE_MAP.put("th-TH", new String[]{"แอปเริ่มต้นไม่สำเร็จ", "แอปเริ่มต้นไม่สำเร็จหลายครั้ง กรุณาลองตัวเลือกต่อไปนี้", "ส่งออกบันทึก", "ลองอีกครั้ง", "ซ่อมแซมอัตโนมัติ", "ซ่อมแซมเสร็จสิ้น", "ข้อผิดพลาด", "ตกลง", "ส่งออกบันทึกไม่สำเร็จ", "ซ่อมแซมไม่สำเร็จ", "ไม่พบไฟล์บันทึก"});
        LOCALE_MAP.put("uk-UA", new String[]{"Не вдалося запустити додаток", "Додаток не вдалося запустити кілька разів. Спробуйте наступні варіанти.", "Експорт журналів", "Спробувати знову", "Автовідновлення", "Відновлення завершено", "Помилка", "OK", "Не вдалося експортувати журнали", "Не вдалося виконати відновлення", "Файли журналів не знайдено"});
        LOCALE_MAP.put("vi", new String[]{"Ứng dụng không khởi động được", "Ứng dụng đã không khởi động được nhiều lần. Vui lòng thử các tùy chọn sau.", "Xuất nhật ký", "Thử lại", "Tự động sửa chữa", "Sửa chữa hoàn tất", "Lỗi", "OK", "Xuất nhật ký thất bại", "Sửa chữa thất bại", "Không tìm thấy tệp nhật ký"});
    }

    // Script-to-region mapping for CJK script subtags.
    // Android uses BCP 47 script subtags for Chinese variants in Locale.toLanguageTag():
    //   - Simplified Chinese → "zh-Hans-CN" or "zh-Hans"
    //   - Traditional Chinese (TW) → "zh-Hant-TW" or "zh-TW"
    //   - Traditional Chinese (HK) → "zh-Hant-HK" or "zh-HK"
    // Our i18n keys use region codes (zh-CN, zh-TW, zh-HK), so we map:
    //   Hans → zh-CN, Hant → zh-Hant (Traditional Chinese, shared by TW/HK)
    private static final java.util.Map<String, String> SCRIPT_MAP = new java.util.HashMap<>();
    static {
        SCRIPT_MAP.put("Hans", "zh-CN");
        SCRIPT_MAP.put("Hant", "zh-Hant");
    }

    // Aliases: zh-TW and zh-HK both map to zh-Hant
    private static final java.util.Map<String, String> ALIAS_MAP = new java.util.HashMap<>();
    static {
        ALIAS_MAP.put("zh-TW", "zh-Hant");
        ALIAS_MAP.put("zh-HK", "zh-Hant");
    }

    // Locale matching priority:
    //   1. Exact match (e.g. "ja-JP", "de")
    //   2. Alias mapping (e.g. "zh-TW" → "zh-Hant", "zh-HK" → "zh-Hant")
    //   3. Script subtag mapping (e.g. "zh-Hans-CN" → Hans → "zh-CN")
    //   4. First-last parts (e.g. "zh-Hans-CN" → "zh-CN")
    //   4. Prefix match (e.g. "fr" → "fr-FR", "ja" → "ja-JP")
    //   5. Fallback to "en"
    private void resolveLocale() {
        String lang = Locale.getDefault().toLanguageTag(); // e.g. "zh-Hans-CN", "ja-JP", "en-US"
        String[] strings = LOCALE_MAP.get(lang);
        // Alias mapping: "zh-TW" → "zh-Hant", "zh-HK" → "zh-Hant"
        if (strings == null) {
            String aliased = ALIAS_MAP.get(lang);
            if (aliased != null) strings = LOCALE_MAP.get(aliased);
        }
        // Script subtag mapping
        if (strings == null) {
            String[] parts = lang.split("-");
            for (String part : parts) {
                String mapped = SCRIPT_MAP.get(part);
                if (mapped != null) {
                    strings = LOCALE_MAP.get(mapped);
                    break;
                }
            }
        }
        // First-last parts: "zh-Hans-CN" → "zh-CN", "zh-Hant-HK" → "zh-HK"
        if (strings == null) {
            String[] parts = lang.split("-");
            if (parts.length >= 2) {
                strings = LOCALE_MAP.get(parts[0] + "-" + parts[parts.length - 1]);
            }
        }
        // Prefix match: "fr" → "fr-FR"
        if (strings == null) {
            String code = lang.split("-")[0];
            strings = LOCALE_MAP.get(code);
            if (strings == null) {
                for (java.util.Map.Entry<String, String[]> e : LOCALE_MAP.entrySet()) {
                    if (e.getKey().startsWith(code + "-")) {
                        strings = e.getValue();
                        break;
                    }
                }
            }
        }
        if (strings == null) strings = LOCALE_MAP.get("en");
        sTitle = strings[0]; sSubtitle = strings[1]; sExportLogs = strings[2];
        sTryAgain = strings[3]; sAutoRepair = strings[4]; sRepairComplete = strings[5];
        sError = strings[6]; sOk = strings[7]; sExportError = strings[8];
        sRepairError = strings[9]; sNoLogs = strings[10];
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_recovery);
        resolveLocale();
        setupUI();
    }

    private void setupUI() {
        TextView title = findViewById(R.id.title);
        TextView subtitle = findViewById(R.id.subtitle);
        Button btnExportLogs = findViewById(R.id.btn_export_logs);
        Button btnTryAgain = findViewById(R.id.btn_try_again);
        Button btnAutoRepair = findViewById(R.id.btn_auto_repair);
        TextView versionLabel = findViewById(R.id.version_label);

        title.setText(sTitle);
        subtitle.setText(sSubtitle);
        btnExportLogs.setText(sExportLogs);
        btnTryAgain.setText(sTryAgain);
        btnAutoRepair.setText(sAutoRepair);

        versionLabel.setText("v" + BuildConfig.VERSION_NAME);

        btnExportLogs.setOnClickListener(v -> exportLogs());
        btnTryAgain.setOnClickListener(v -> tryAgain());
        btnAutoRepair.setOnClickListener(v -> autoRepair());
    }

    private void exportLogs() {
        try {
            File logDir = findNativeLoggerDir();
            if (logDir == null || !logDir.exists() || !logDir.isDirectory()) {
                showError(sNoLogs);
                return;
            }

            File[] logFiles = logDir.listFiles();
            if (logFiles == null || logFiles.length == 0) {
                showError(sNoLogs);
                return;
            }

            File zipFile = new File(getCacheDir(), "onekey_logs.zip");
            zipDirectory(logDir, zipFile);

            Uri uri = OnekeyFileProvider.getUriForFile(this, zipFile);
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/zip");
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(shareIntent, sExportLogs));
        } catch (Exception e) {
            showError(sExportError + ": " + e.getMessage());
        }
    }

    private File findNativeLoggerDir() {
        // Match OneKeyLog.logsDirectory path: cacheDir/logs
        // Cannot use OneKeyLog.INSTANCE here because NitroModules.applicationContext
        // may not be initialized in recovery mode.
        File logsDir = new File(getCacheDir(), "logs");
        if (logsDir.exists() && logsDir.isDirectory()) {
            return logsDir;
        }
        return null;
    }

    private void zipDirectory(File sourceDir, File zipFile) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(zipFile);
             ZipOutputStream zos = new ZipOutputStream(fos)) {
            zipFiles(sourceDir, sourceDir.getName(), zos);
        }
    }

    private void zipFiles(File file, String parentPath, ZipOutputStream zos) throws IOException {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    zipFiles(child, parentPath + "/" + child.getName(), zos);
                }
            }
        } else {
            try (FileInputStream fis = new FileInputStream(file)) {
                ZipEntry entry = new ZipEntry(parentPath);
                zos.putNextEntry(entry);
                byte[] buffer = new byte[4096];
                int len;
                while ((len = fis.read(buffer)) > 0) {
                    zos.write(buffer, 0, len);
                }
                zos.closeEntry();
            }
        }
    }

    private void tryAgain() {
        try {
            SharedPreferences prefs = getSharedPreferences("onekey_recovery", MODE_PRIVATE);
            prefs.edit()
                .putInt("consecutive_boot_fail_count", 0)
                .putString("recovery_action", "try_again")
                .commit();
            restartApp();
        } catch (Exception e) {
            showError(sError + ": " + e.getMessage());
        }
    }

    private void autoRepair() {
        try {
            Context context = getApplicationContext();

            // Clear bundle update data
            BundleUpdateStoreAndroid.INSTANCE.clearUpdateBundleData(context);

            // Delete onekey-bundle directory
            File bundleDir = new File(getFilesDir(), "onekey-bundle");
            deleteRecursive(bundleDir);

            // Delete onekey-bundle-download directory
            File bundleDownloadDir = new File(getFilesDir(), "onekey-bundle-download");
            deleteRecursive(bundleDownloadDir);

            // Clear recovery-related keys from MMKV
            clearMmkvRecoveryKeys();

            // Clear app cache
            clearAppCache();

            // Reset counter and set recovery action (single atomic write)
            SharedPreferences prefs = getSharedPreferences("onekey_recovery", MODE_PRIVATE);
            prefs.edit()
                .putInt("consecutive_boot_fail_count", 0)
                .putString("recovery_action", "auto_repair")
                .commit();

            // Show success dialog, restart on confirm
            new AlertDialog.Builder(this)
                .setTitle(sRepairComplete)
                .setMessage(null)
                .setCancelable(false)
                .setPositiveButton(sOk, (dialog, which) -> restartApp())
                .show();
        } catch (Exception e) {
            showError(sRepairError + ": " + e.getMessage());
        }
    }

    private void deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory == null || !fileOrDirectory.exists()) {
            return;
        }
        if (fileOrDirectory.isDirectory()) {
            File[] children = fileOrDirectory.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        fileOrDirectory.delete();
    }

    private void clearMmkvRecoveryKeys() {
        try {
            MMKV.initialize(this);
            MMKV mmkv = MMKV.mmkvWithID("onekey-app-setting");
            if (mmkv != null) {
                mmkv.removeValueForKey("onekey_pending_install_task");
                mmkv.removeValueForKey("onekey_whats_new_shown");
                mmkv.removeValueForKey("last_valid_server_time");
                mmkv.removeValueForKey("last_valid_local_time");
            }
        } catch (Exception e) {
            // Ignore — MMKV may not be available in recovery mode
        }
    }

    private void clearAppCache() {
        try {
            File cacheDir = getCacheDir();
            File[] children = cacheDir.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        } catch (Exception e) {
            // Ignore cache clearing failures
        }
    }

    private void restartApp() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(launchIntent);
        }
        finish();
        Process.killProcess(Process.myPid());
    }

    private void showError(String message) {
        new AlertDialog.Builder(this)
                .setTitle(sError)
                .setMessage(message)
                .setPositiveButton(sOk, null)
                .show();
    }
}
