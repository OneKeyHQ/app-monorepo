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
        LOCALE_MAP.put("en", new String[]{"We hit a snag", "It looks like the app had trouble starting. A quick fix should get things back to normal.", "Export Logs", "Not Now", "Quick Fix", "Repair Complete", "Error", "OK", "Failed to export logs", "Repair failed", "No log files found"});
        LOCALE_MAP.put("zh-CN", new String[]{"遇到了一点问题", "应用似乎未能正常启动，快速修复一下试试？", "导出日志", "暂不修复", "快速修复", "修复完成", "错误", "确定", "导出日志失败", "修复失败", "未找到日志文件"});
        // Traditional Chinese — shared by zh-TW, zh-HK, zh-Hant
        LOCALE_MAP.put("zh-Hant", new String[]{"遇到了一點問題", "應用程式似乎未能正常啟動，快速修復一下試試？", "匯出日誌", "暫不修復", "快速修復", "修復完成", "錯誤", "確定", "匯出日誌失敗", "修復失敗", "未找到日誌檔案"});
        LOCALE_MAP.put("ja-JP", new String[]{"問題が発生しました", "アプリの起動がうまくいかなかったようです。クイック修復をお試しください。", "ログを書き出す", "今はしない", "クイック修復", "修復完了", "エラー", "OK", "ログの書き出しに失敗しました", "修復に失敗しました", "ログファイルが見つかりません"});
        LOCALE_MAP.put("ko-KR", new String[]{"문제가 발생했어요", "앱이 정상적으로 시작되지 않은 것 같아요. 빠른 수리를 시도해 보세요.", "로그 내보내기", "나중에", "빠른 수리", "복구 완료", "오류", "확인", "로그 내보내기 실패", "복구 실패", "로그 파일을 찾을 수 없습니다"});
        LOCALE_MAP.put("de", new String[]{"Ein kleines Problem", "Die App scheint nicht richtig gestartet zu sein. Eine Schnellreparatur sollte helfen.", "Protokolle exportieren", "Nicht jetzt", "Schnellreparatur", "Reparatur abgeschlossen", "Fehler", "OK", "Protokollexport fehlgeschlagen", "Reparatur fehlgeschlagen", "Keine Protokolldateien gefunden"});
        LOCALE_MAP.put("es", new String[]{"Algo no salió bien", "Parece que la aplicación tuvo problemas al iniciarse. Una reparación rápida debería solucionarlo.", "Exportar registros", "Ahora no", "Reparación rápida", "Reparación completada", "Error", "OK", "Error al exportar registros", "Reparación fallida", "No se encontraron archivos de registro"});
        LOCALE_MAP.put("fr-FR", new String[]{"Un petit souci", "L'application semble avoir eu du mal à démarrer. Une réparation rapide devrait arranger les choses.", "Exporter les journaux", "Pas maintenant", "Réparation rapide", "Réparation terminée", "Erreur", "OK", "Échec de l'exportation des journaux", "Échec de la réparation", "Aucun fichier journal trouvé"});
        LOCALE_MAP.put("it-IT", new String[]{"Un piccolo problema", "Sembra che l'app abbia avuto difficoltà ad avviarsi. Una riparazione rapida dovrebbe risolvere.", "Esporta log", "Non ora", "Riparazione rapida", "Riparazione completata", "Errore", "OK", "Esportazione log non riuscita", "Riparazione non riuscita", "Nessun file di log trovato"});
        LOCALE_MAP.put("pt", new String[]{"Um pequeno problema", "A aplicação parece ter tido dificuldades ao iniciar. Uma reparação rápida deverá resolver.", "Exportar registos", "Agora não", "Reparação rápida", "Reparação concluída", "Erro", "OK", "Falha ao exportar registos", "Falha na reparação", "Nenhum ficheiro de registo encontrado"});
        LOCALE_MAP.put("pt-BR", new String[]{"Um pequeno problema", "O aplicativo parece ter tido dificuldades ao iniciar. Uma correção rápida deve resolver.", "Exportar logs", "Agora não", "Correção rápida", "Reparo concluído", "Erro", "OK", "Falha ao exportar logs", "Falha no reparo", "Nenhum arquivo de log encontrado"});
        LOCALE_MAP.put("ru", new String[]{"Небольшая проблема", "Похоже, приложение не смогло нормально запуститься. Быстрое исправление должно помочь.", "Экспорт журналов", "Не сейчас", "Быстрое исправление", "Восстановление завершено", "Ошибка", "OK", "Не удалось экспортировать журналы", "Не удалось выполнить восстановление", "Файлы журналов не найдены"});
        LOCALE_MAP.put("bn", new String[]{"একটু সমস্যা হয়েছে", "অ্যাপটি সঠিকভাবে চালু হতে পারেনি বলে মনে হচ্ছে। দ্রুত মেরামত করে দেখুন।", "লগ রপ্তানি", "এখন নয়", "দ্রুত মেরামত", "মেরামত সম্পন্ন", "ত্রুটি", "ঠিক আছে", "লগ রপ্তানি ব্যর্থ", "মেরামত ব্যর্থ", "কোনো লগ ফাইল পাওয়া যায়নি"});
        LOCALE_MAP.put("hi-IN", new String[]{"एक छोटी सी समस्या", "ऐप सही से शुरू नहीं हो पाया लगता है। त्वरित मरम्मत से ठीक हो जाना चाहिए।", "लॉग निर्यात करें", "अभी नहीं", "त्वरित मरम्मत", "मरम्मत पूर्ण", "त्रुटि", "ठीक है", "लॉग निर्यात विफल", "मरम्मत विफल", "कोई लॉग फ़ाइल नहीं मिली"});
        LOCALE_MAP.put("id", new String[]{"Ada sedikit masalah", "Sepertinya aplikasi mengalami kendala saat memulai. Perbaikan cepat seharusnya bisa mengatasinya.", "Ekspor log", "Nanti saja", "Perbaikan cepat", "Perbaikan selesai", "Kesalahan", "OK", "Gagal mengekspor log", "Perbaikan gagal", "File log tidak ditemukan"});
        LOCALE_MAP.put("th-TH", new String[]{"พบปัญหาเล็กน้อย", "ดูเหมือนแอปเริ่มต้นไม่สำเร็จ การซ่อมแซมด่วนน่าจะช่วยได้", "ส่งออกบันทึก", "ไว้ทีหลัง", "ซ่อมแซมด่วน", "ซ่อมแซมเสร็จสิ้น", "ข้อผิดพลาด", "ตกลง", "ส่งออกบันทึกไม่สำเร็จ", "ซ่อมแซมไม่สำเร็จ", "ไม่พบไฟล์บันทึก"});
        LOCALE_MAP.put("uk-UA", new String[]{"Невелика проблема", "Схоже, додаток не зміг нормально запуститися. Швидке виправлення має допомогти.", "Експорт журналів", "Не зараз", "Швидке виправлення", "Відновлення завершено", "Помилка", "OK", "Не вдалося експортувати журнали", "Не вдалося виконати відновлення", "Файли журналів не знайдено"});
        LOCALE_MAP.put("vi", new String[]{"Gặp chút trục trặc", "Có vẻ ứng dụng gặp khó khăn khi khởi động. Sửa nhanh sẽ giúp mọi thứ trở lại bình thường.", "Xuất nhật ký", "Để sau", "Sửa nhanh", "Sửa chữa hoàn tất", "Lỗi", "OK", "Xuất nhật ký thất bại", "Sửa chữa thất bại", "Không tìm thấy tệp nhật ký"});
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
        TextView btnExportLogs = findViewById(R.id.btn_export_logs);
        Button btnTryAgain = findViewById(R.id.btn_try_again);
        Button btnAutoRepair = findViewById(R.id.btn_auto_repair);
        TextView versionLabel = findViewById(R.id.version_label);

        title.setText(sTitle);
        subtitle.setText(sSubtitle);
        btnExportLogs.setText(sExportLogs + " \u203A");
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
            SharedPreferences prefs = getSharedPreferences(BootRecoveryKeys.PREFS_NAME, MODE_PRIVATE);
            prefs.edit()
                .putInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, 0)
                .putString(BootRecoveryKeys.RECOVERY_ACTION, "try_again")
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
            SharedPreferences prefs = getSharedPreferences(BootRecoveryKeys.PREFS_NAME, MODE_PRIVATE);
            prefs.edit()
                .putInt(BootRecoveryKeys.CONSECUTIVE_BOOT_FAIL_COUNT, 0)
                .putString(BootRecoveryKeys.RECOVERY_ACTION, "auto_repair")
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
