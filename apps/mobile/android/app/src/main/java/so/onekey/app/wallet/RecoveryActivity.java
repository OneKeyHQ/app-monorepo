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

import com.margelo.nitro.nativelogger.OneKeyLog;
import com.margelo.nitro.reactnativebundleupdate.BundleUpdateStoreAndroid;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class RecoveryActivity extends AppCompatActivity {

    private boolean isChinese;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_recovery);

        isChinese = "zh".equals(Locale.getDefault().getLanguage());

        setupUI();
    }

    private void setupUI() {
        TextView title = findViewById(R.id.title);
        TextView subtitle = findViewById(R.id.subtitle);
        Button btnExportLogs = findViewById(R.id.btn_export_logs);
        Button btnTryAgain = findViewById(R.id.btn_try_again);
        Button btnAutoRepair = findViewById(R.id.btn_auto_repair);
        TextView versionLabel = findViewById(R.id.version_label);

        if (isChinese) {
            title.setText("应用启动失败");
            subtitle.setText("应用已多次启动失败。您可以尝试以下选项来解决问题。");
            btnExportLogs.setText("导出日志");
            btnTryAgain.setText("重试");
            btnAutoRepair.setText("自动修复");
        } else {
            title.setText("App Failed to Start");
            subtitle.setText("The app has failed to start multiple times. You can try the following options to resolve the issue.");
            btnExportLogs.setText("Export Logs");
            btnTryAgain.setText("Try Again");
            btnAutoRepair.setText("Auto Repair");
        }

        versionLabel.setText("v" + BuildConfig.VERSION_NAME);

        btnExportLogs.setOnClickListener(v -> exportLogs());
        btnTryAgain.setOnClickListener(v -> tryAgain());
        btnAutoRepair.setOnClickListener(v -> autoRepair());
    }

    private void exportLogs() {
        try {
            File logDir = findNativeLoggerDir();
            if (logDir == null || !logDir.exists() || !logDir.isDirectory()) {
                showError(isChinese ? "未找到日志文件" : "No log files found");
                return;
            }

            File[] logFiles = logDir.listFiles();
            if (logFiles == null || logFiles.length == 0) {
                showError(isChinese ? "日志文件为空" : "Log files are empty");
                return;
            }

            File zipFile = new File(getCacheDir(), "onekey_logs.zip");
            zipDirectory(logDir, zipFile);

            Uri uri = OnekeyFileProvider.getUriForFile(this, zipFile);
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/zip");
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(shareIntent, isChinese ? "导出日志" : "Export Logs"));
        } catch (Exception e) {
            showError((isChinese ? "导出日志失败: " : "Failed to export logs: ") + e.getMessage());
        }
    }

    private File findNativeLoggerDir() {
        // Use OneKeyLog API to get the actual log directory
        String logPath = OneKeyLog.INSTANCE.getLogsDirectory();
        if (logPath != null && !logPath.isEmpty()) {
            File logsDir = new File(logPath);
            if (logsDir.exists() && logsDir.isDirectory()) {
                return logsDir;
            }
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
            showError((isChinese ? "重试失败: " : "Try again failed: ") + e.getMessage());
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
                .setTitle(isChinese ? "修复完成" : "Repair Complete")
                .setMessage(null)
                .setCancelable(false)
                .setPositiveButton(isChinese ? "确定" : "OK", (dialog, which) -> restartApp())
                .show();
        } catch (Exception e) {
            showError((isChinese ? "自动修复失败: " : "Auto repair failed: ") + e.getMessage());
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

    private void clearAppCache() {
        try {
            File cacheDir = getCacheDir();
            deleteRecursive(cacheDir);
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
                .setTitle(isChinese ? "错误" : "Error")
                .setMessage(message)
                .setPositiveButton(isChinese ? "确定" : "OK", null)
                .show();
    }
}
