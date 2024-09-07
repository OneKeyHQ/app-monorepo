package so.onekey.app.wallet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.io.BufferedInputStream;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.File;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.concurrent.TimeUnit;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import okhttp3.Call;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okio.Buffer;
import okio.BufferedSink;
import okio.BufferedSource;
import okio.Okio;

public class AutoUpdateModule extends ReactContextBaseJavaModule {
    private NotificationManagerCompat mNotifyManager;
    private NotificationCompat.Builder mBuilder;
    private ReactApplicationContext rContext;
    private Thread rThread;
    private Boolean isDownloading = false;
    private int notifiactionId = 1;
    private String channelId = "updateApp";
    private static final String PUBLIC_KEY = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n" +
            "\n" +
            "mQINBGJATGwBEADL1K7b8dzYYzlSsvAGiA8mz042pygB7AAh/uFUycpNQdSzuoDE\n" +
            "VoXq/QsXCOsGkMdFLwlUjarRaxFX6RTV6S51LOlJFRsyGwXiMz08GSNagSafQ0YL\n" +
            "Gi+aoemPh6Ta5jWgYGIUWXavkjJciJYw43ACMdVmIWos94bA41Xm93dq9C3VRpl+\n" +
            "EjvGAKRUMxJbH8r13TPzPmfN4vdrHLq+us7eKGJpwV/VtD9vVHAi0n48wGRq7DQw\n" +
            "IUDU2mKy3wmjwS38vIIu4yQyeUdl4EqwkCmGzWc7Cv2HlOG6rLcUdTAOMNBBX1IQ\n" +
            "iHKg9Bhh96MXYvBhEL7XHJ96S3+gTHw/LtrccBM+eiDJVHPZn+lw2HqX994DueLV\n" +
            "tAFDS+qf3ieX901IC97PTHsX6ztn9YZQtSGBJO3lEMBdC4ez2B7zUv4bgyfU+KvE\n" +
            "zHFIK9HmDehx3LoDAYc66nhZXyasiu6qGPzuxXu8/4qTY8MnhXJRBkbWz5P84fx1\n" +
            "/Db5WETLE72on11XLreFWmlJnEWN4UOARrNn1Zxbwl+uxlSJyM+2GTl4yoccG+WR\n" +
            "uOUCmRXTgduHxejPGI1PfsNmFpVefAWBDO7SdnwZb1oUP3AFmhH5CD1GnmLnET+l\n" +
            "/c+7XfFLwgSUVSADBdO3GVS4Cr9ux4nIrHGJCrrroFfM2yvG8AtUVr16PQARAQAB\n" +
            "tCJvbmVrZXlocSBkZXZlbG9wZXIgPGRldkBvbmVrZXkuc28+iQJUBBMBCAA+FiEE\n" +
            "62iuVE8f3YzSZGJPs2mmepC/OHsFAmJATGwCGwMFCQeGH0QFCwkIBwIGFQoJCAsC\n" +
            "BBYCAwECHgECF4AACgkQs2mmepC/OHtgvg//bsWFMln08ZJjf5od/buJua7XYb3L\n" +
            "jWq1H5rdjJva5TP1UuQaDULuCuPqllxb+h+RB7g52yRG/1nCIrpTfveYOVtq/mYE\n" +
            "D12KYAycDwanbmtoUp25gcKqCrlNeSE1EXmPlBzyiNzxJutE1DGlvbY3rbuNZLQi\n" +
            "UTFBG3hk6JgsaXkFCwSmF95uATAaItv8aw6eY7RWv47rXhQch6PBMCir4+a/v7vs\n" +
            "lXxQtcpCqfLtjrloq7wvmD423yJVsUGNEa7/BrwFz6/GP6HrUZc6JgvrieuiBE4n\n" +
            "ttXQFm3dkOfD+67MLMO3dd7nPhxtjVEGi+43UH3/cdtmU4JFX3pyCQpKIlXTEGp2\n" +
            "wqim561auKsRb1B64qroCwT7aACwH0ZTgQS8rPifG3QM8ta9QheuOsjHLlqjo8jI\n" +
            "fpqe0vKYUlT092joT0o6nT2MzmLmHUW0kDqD9p6JEJEZUZpqcSRE84eMTFNyu966\n" +
            "xy/rjN2SMJTFzkNXPkwXYrMYoahGez1oZfLzV6SQ0+blNc3aATt9aQW6uaCZtMw1\n" +
            "ibcfWW9neHVpRtTlMYCoa2reGaBGCv0Nd8pMcyFUQkVaes5cQHkh3r5Dba+YrVvp\n" +
            "l4P8HMbN8/LqAv7eBfj3ylPa/8eEPWVifcum2Y9TqherN1C2JDqWIpH4EsApek3k\n" +
            "NMK6q0lPxXjZ3Pa5Ag0EYkBMbAEQAM1R4N3bBkwKkHeYwsQASevUkHwY4eg6Ncgp\n" +
            "f9NbmJHcEioqXTIv0nHCQbos3P2NhXvDowj4JFkK/ZbpP9yo0p7TI4fckseVSWwI\n" +
            "tiF9l/8OmXvYZMtw3hHcUUZVdJnk0xrqT6ni6hyRFIfbqous6/vpqi0GG7nB/+lU\n" +
            "E5StGN8696ZWRyAX9MmwoRoods3ShNJP0+GCYHfIcG0XRhEDMJph+7mWPlkQUcza\n" +
            "4aEjxOQ4Stwwp+ZL1rXSlyJIPk1S9/FIS/Uw5GgqFJXIf5n+SCVtUZ8lGedEWwe4\n" +
            "wXsoPFxxOc2Gqw5r4TrJFdgA3MptYebXmb2LGMssXQTM1AQS2LdpnWw44+X1CHvQ\n" +
            "0m4pEw/g2OgeoJPBurVUnu2mU/M+ARZiS4ceAR0pLZN7Yq48p1wr6EOBQdA3Usby\n" +
            "uc17MORG/IjRmjz4SK/luQLXjN+0jwQSoM1kcIHoRk37B8feHjVufJDKlqtw83H1\n" +
            "uNu6lGwb8MxDgTuuHloDijCDQsn6m7ZKU1qqLDGtdvCUY2ovzuOUS9vv6MAhR86J\n" +
            "kqoU3sOBMeQhnBaTNKU0IjT4M+ERCWQ7MewlzXuPHgyb4xow1SKZny+f+fYXPy9+\n" +
            "hx4/j5xaKrZKdq5zIo+GRGe4lA088l253nGeLgSnXsbSxqADqKK73d7BXLCVEZHx\n" +
            "f4Sa5JN7ABEBAAGJAjwEGAEIACYWIQTraK5UTx/djNJkYk+zaaZ6kL84ewUCYkBM\n" +
            "bAIbDAUJB4YfRAAKCRCzaaZ6kL84e0UGD/4mVWyGoQC86TyPoU4Pb5r8mynXWmiH\n" +
            "ZGKu2ll8qn3l5Q67OophgbA1I0GTBFsYK2f91ahgs7FEsLrmz/25E8ybcdJipITE\n" +
            "6869nyE1b37jVb3z3BJLYS/4MaNvugNz4VjMHWVAL52glXLN+SJBSNscmWZDKnVn\n" +
            "Rnrn+kBEvOWZgLbi4MpPiNVwm2PGnrtPzudTcg/NS3HOcmJTfG3mrnwwNJybTVAx\n" +
            "txlQPoXUpJQqJjtkPPW+CqosolpRdugQ5zpFSg05iL+vN+CMrVPkk85w87dtsidl\n" +
            "yZl/ZNITrLzym9d2UFVQZY2rRohNdRfx3l4rfXJFLaqQtihRvBIiMKTbUb2V0pd3\n" +
            "rVLz2Ck3gJqPfPEEmCWS0Nx6rME8m0sOkNyMau3dMUUAs4j2c3pOQmsZRjKo7LAc\n" +
            "7/GahKFhZ2aBCQzvcTES+gPH1Z5HnivkcnUF2gnQV9x7UOr1Q/euKJsxPl5CCZtM\n" +
            "N9GFW10cDxFo7cO5Ch+/BkkkfebuI/4Wa1SQTzawsxTx4eikKwcemgfDsyIqRs2W\n" +
            "62PBrqCzs9Tg19l35sCdmvYsvMadrYFXukHXiUKEpwJMdTLAtjJ+AX84YLwuHi3+\n" +
            "qZ5okRCqZH+QpSojSScT9H5ze4ZpuP0d8pKycxb8M2RfYdyOtT/eqsZ/1EQPg7kq\n" +
            "P2Q5dClenjjjVA==\n" +
            "=F0np\n" +
            "-----END PGP PUBLIC KEY BLOCK-----";


    AutoUpdateModule(ReactApplicationContext context) {
        super(context);
        rContext = context;
        mNotifyManager = NotificationManagerCompat.from(this.rContext.getApplicationContext());
    }

    public String getName() {
        return "AutoUpdateModule";
    }

    private void sendEvent(String eventName, @Nullable WritableMap params) {
        rContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, params);
    }

    private void sendDownloadError(Exception e, Promise promise) {
        isDownloading = false;
        WritableMap params = Arguments.createMap();
        params.putString("message", e.getMessage());
        sendEvent("update/error", params);
        promise.reject(e);
    }

    private File buildFile(String path) {
        return new File(path.replace("file:///", "/"));
    }
    private String bytesToHex(byte[] bytes) {
        StringBuffer result = new StringBuffer();
        for (byte byt : bytes) {
            result.append(Integer.toString((byt & 0xff) + 0x100, 16).substring(1));
        }
        return result.toString();
    }

    public boolean checkFilePackage(File file, @Nullable String sha256, Promise promise) {
        PackageManager pm = getReactApplicationContext().getPackageManager();
        PackageInfo info = pm.getPackageArchiveInfo(file.getAbsolutePath(), 0);
        String appPackageName = getReactApplicationContext().getPackageName();
        if (info != null && info.packageName != null) {
            Log.d("check-packageName:", info.packageName + " " + appPackageName + " " + String.valueOf(info.packageName.equals(appPackageName)));
            if (!info.packageName.equals(appPackageName)) {
                promise.reject(new Exception("Installation package name mismatch"));
                return false;
            }
        }

        // Verify SHA256 and GPG signature
        try {
            // Fetch the signature file
            String ascFileUrl = downloadUrl + ".SHA256SUMS.asc";
            URL url = new URL(ascFileUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
            StringBuilder ascFileContent = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                ascFileContent.append(line).append("\n");
            }
            reader.close();
            
            // Verify GPG signature
            PGPPublicKeyRing publicKeyRing = PGPPublicKeyRing.decodePublicKeyRing(Base64.getDecoder().decode(PUBLIC_KEY));
            PGPSignature signature = PGPSignature.readSignatures(new ByteArrayInputStream(ascFileContent.toString().getBytes())).get(0);
            signature.init(new BcPGPContentVerifierBuilderProvider(), publicKeyRing.getPublicKey());
            
            if (!signature.verify()) {
                promise.reject(new Exception("GPG signature verification failed"));
                return false;
            }
            
            // Extract SHA256 from the verified content
            String[] lines = ascFileContent.toString().split("\n");
            String extractedSha256 = lines[0].split(" ")[0];
            
            // Verify SHA256
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (BufferedInputStream bis = new BufferedInputStream(new FileInputStream(file))) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = bis.read(buffer)) > 0) {
                    digest.update(buffer, 0, count);
                }
            }
            String calculatedSha256 = bytesToHex(digest.digest());
            
            if (!calculatedSha256.equals(extractedSha256)) {
                promise.reject(new Exception("SHA256 mismatch"));
                return false;
            }
            
            return true;
        } catch (Exception e) {
            promise.reject(e);
            return false;
        }

        return true;
    }

    @ReactMethod void verifyAPK(final ReadableMap map, final Promise promise) {
        String filePath = map.getString("filePath");
        String sha256 = map.getString("sha256");

        File downloadedFile = buildFile(filePath);
        if (!downloadedFile.exists()) {
            promise.reject(new Exception("The APK file does not exist."));
        }
        boolean isValidAPK = this.checkFilePackage(downloadedFile, sha256, promise);
        if (isValidAPK) {
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void clearCache(final Promise promise) {
        if (this.rThread != null) {
            this.rThread.interrupt();
        }
        this.isDownloading = false;
        promise.resolve(null);
    }

    @ReactMethod
    public void downloadAPK(final ReadableMap map, final Promise promise) {
        String url = map.getString("url");
        String filePath = map.getString("filePath");
        String notificationTitle = map.getString("notificationTitle");
        String sha256 = map.getString("sha256");
        boolean isResume = map.getBoolean("isResume");
        if (this.isDownloading) {
            return;
        }
        this.isDownloading = true;
        this.rThread = new Thread(new Runnable() {
            private Call call;
            boolean checkInterrupt() {
                boolean isInterrupted = Thread.currentThread().isInterrupted();
                if (isInterrupted && call != null) {
                    this.call.cancel();
                }
                return isInterrupted;
            };

            public void run() {
                File downloadedFile = buildFile(filePath);
                long downloadedLength = 0;
                if (downloadedFile.exists()) {
                    if (isResume) {
                        downloadedLength = downloadedFile.length();
                    } else {
                        downloadedFile.delete();
                    }
                }

                mBuilder = new NotificationCompat.Builder(rContext.getApplicationContext(), channelId)
                        .setContentTitle(notificationTitle)
                        .setContentText("Download in progress")
                        .setOngoing(true)
                        .setPriority(NotificationCompat.PRIORITY_LOW)
                        .setSmallIcon(R.drawable.ic_notification);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    NotificationChannel channel = new NotificationChannel(channelId, "updateApp", NotificationManager.IMPORTANCE_DEFAULT);
                    mNotifyManager.createNotificationChannel(channel);
                }

                Request request = new Request.Builder()
                        .url(url)
                        .addHeader("Range", "bytes=" + downloadedLength + "-")
                        .build();
                OkHttpClient client = new OkHttpClient.Builder()
                        .connectTimeout(10, TimeUnit.SECONDS)
                        .build();
                Response response = null;
                this.call = client.newCall(request);
                try {
                    response = this.call.execute();
                } catch (IOException e) {
                    sendDownloadError(e, promise);
                    return;
                }

                if (!response.isSuccessful()) {
                    sendDownloadError(new Exception("Server not responding, please try again later."), promise);
                    return;
                }

                ResponseBody body = response.body();
                long contentLength = body.contentLength() + downloadedLength;
                BufferedSource source = body.source();

                BufferedSink sink = null;
                try {
                    sink = Okio.buffer(Okio.appendingSink(downloadedFile));
                } catch (FileNotFoundException e) {
                    sendDownloadError(e, promise);
                    return;
                }
                Buffer sinkBuffer = sink.buffer();

                long totalBytesRead = downloadedLength;
                int bufferSize = 8 * 1024;
                sendEvent("update/start", null);
                int prevProgress = (int) ((totalBytesRead * 100) / contentLength);
                try {
                    for (long bytesRead; (bytesRead = source.read(sinkBuffer, bufferSize)) != -1;) {
                        try {
                            sink.emit();
                        } catch (IOException e) {
                            sendDownloadError(e, promise);
                            return;
                        }
                        totalBytesRead += bytesRead;
                        int progress = (int) ((totalBytesRead * 100) / contentLength);
                        if (prevProgress != progress) {
                            try {
                                WritableMap params = Arguments.createMap();
                                params.putInt("progress", progress);
                                sendEvent("update/downloading", params);
                                Log.i("update/progress", progress + "");
                            } catch (Exception e) {
                                sendDownloadError(e, promise);
                                return;
                            }
                            mBuilder.setProgress(100, progress, false);
                            notifyNotification(notifiactionId, mBuilder);
                            prevProgress = progress;
                            if (this.checkInterrupt()) {
                                return;
                            }
                        }
                    }
                } catch (IOException e) {
                    sendDownloadError(e, promise);
                    return;
                }
                try {
                    sink.flush();
                    sink.close();
                    source.close();
                } catch (IOException e) {
                    sendDownloadError(e, promise);
                    return;
                }
                Log.d("UPDATE APP", "downloadPackage: Download completed");
                sendEvent("update/downloaded", null);

                if (this.checkInterrupt()) {
                    return;
                }
                isDownloading = false;

                Intent installIntent = new Intent(Intent.ACTION_VIEW);

                boolean isValidAPK = checkFilePackage(downloadedFile, sha256, promise);
                Uri apkUri = OnekeyFileProvider.getUriForFile(rContext, downloadedFile);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                PendingIntent pendingIntent = isValidAPK ? PendingIntent.getActivity(rContext, 0, installIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
                        : null;

                mNotifyManager.cancel(notifiactionId);
                mBuilder.setContentText("Download completed, click to install")
                        .setProgress(0, 0, false)
                        .setOngoing(false)
                        .setContentIntent(pendingIntent)
                        .setAutoCancel(true);

                notifyNotification(notifiactionId, mBuilder);
                Log.d("UPDATE APP", "downloadPackage: notifyNotification done");
                promise.resolve(null);
            }
        });
        this.rThread.start();
    }


    public void notifyNotification(int notificationId, NotificationCompat.Builder builder) {
        try {
            NotificationManagerCompat mNotifyManager = NotificationManagerCompat.from(this.rContext.getApplicationContext());
            if (ActivityCompat.checkSelfPermission(this.rContext, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            mNotifyManager.notify(notificationId, builder.build());
        } catch (Exception e) {
            Log.d("notification", e.getMessage());
        }
    }

    @ReactMethod
    public void installAPK(final ReadableMap map, final Promise promise) {
        String filePath = map.getString("filePath");
        String sha256 = map.getString("sha256");
        File file = buildFile(filePath);
        if (!this.checkFilePackage(file, sha256, promise)) {
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                Uri apkUri = OnekeyFileProvider.getUriForFile(rContext, file);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            } else {
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                intent.setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive");
            }
            promise.resolve(null);
            rContext.getCurrentActivity().startActivity(intent);
        } catch (Exception e) {
            promise.reject(e);
        }
    }
}
