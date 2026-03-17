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
            title.setText("\u5E94\u7528\u542F\u52A8\u5931\u8D25");
            subtitle.setText("\u5E94\u7528\u5DF2\u591A\u6B21\u542F\u52A8\u5931\u8D25\u3002\u60A8\u53EF\u4EE5\u5C1D\u8BD5\u4EE5\u4E0B\u9009\u9879\u6765\u89E3\u51B3\u95EE\u9898\u3002");
            btnExportLogs.setText("\u5BFC\u51FA\u65E5\u5FD7");
            btnTryAgain.setText("\u91CD\u8BD5");
            btnAutoRepair.setText("\u81EA\u52A8\u4FEE\u590D");
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
                showError(isChinese ? "\u672A\u627E\u5230\u65E5\u5FD7\u6587\u4EF6" : "No log files found");
                return;
            }

            File[] logFiles = logDir.listFiles();
            if (logFiles == null || logFiles.length == 0) {
                showError(isChinese ? "\u65E5\u5FD7\u6587\u4EF6\u4E3A\u7A7A" : "Log files are empty");
                return;
            }

            File zipFile = new File(getCacheDir(), "onekey_logs.zip");
            zipDirectory(logDir, zipFile);

            Uri uri = OnekeyFileProvider.getUriForFile(this, zipFile);
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/zip");
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(shareIntent, isChinese ? "\u5BFC\u51FA\u65E5\u5FD7" : "Export Logs"));
        } catch (Exception e) {
            showError((isChinese ? "\u5BFC\u51FA\u65E5\u5FD7\u5931\u8D25: " : "Failed to export logs: ") + e.getMessage());
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
            showError((isChinese ? "\u91CD\u8BD5\u5931\u8D25: " : "Try again failed: ") + e.getMessage());
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

            restartApp();
        } catch (Exception e) {
            showError((isChinese ? "\u81EA\u52A8\u4FEE\u590D\u5931\u8D25: " : "Auto repair failed: ") + e.getMessage());
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
                .setTitle(isChinese ? "\u9519\u8BEF" : "Error")
                .setMessage(message)
                .setPositiveButton(isChinese ? "\u786E\u5B9A" : "OK", null)
                .show();
    }
}
