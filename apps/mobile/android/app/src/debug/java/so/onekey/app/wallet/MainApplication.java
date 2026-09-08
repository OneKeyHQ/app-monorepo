package so.onekey.app.wallet;

import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.backgroundthread.BackgroundThreadManager;
import com.margelo.nitro.nativelogger.OneKeyLog;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Pattern;

import org.json.JSONObject;

public final class MainApplication extends BaseMainApplication {
  private static final String DEV_SHELL_CONTRACT_ASSET = "onekey-dev-shell-contract.json";
  private static final String DEV_SESSION_ROOT = "onekey-dev-sessions";
  private static final Pattern DEV_VENDOR_FINGERPRINT_PATTERN = Pattern.compile("^[0-9a-f]{64}$");
  private static final Pattern DEV_SESSION_ID_PATTERN = Pattern.compile("^wk-[0-9a-f]{12}-dev-[0-9a-f]{12}-[0-9a-f]{16}$");
  private static final int MAX_DEV_SESSION_BYTES = 2 * 1024 * 1024;
  private static final long MAX_DEV_VENDOR_BYTES = 512L * 1024L * 1024L;

  @Nullable
  private BuildVariantBundleInfo buildVariantBundleInfo;

  @NonNull
  private String sha256File(@NonNull File file) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] buffer = new byte[8192];
    try (InputStream input = new FileInputStream(file)) {
      int count;
      while ((count = input.read(buffer)) != -1) {
        digest.update(buffer, 0, count);
      }
    }
    char[] hex = new char[64];
    char[] digits = "0123456789abcdef".toCharArray();
    byte[] hash = digest.digest();
    for (int index = 0; index < hash.length; index += 1) {
      int value = hash[index] & 0xff;
      hex[index * 2] = digits[value >>> 4];
      hex[index * 2 + 1] = digits[value & 0x0f];
    }
    return new String(hex);
  }

  @NonNull
  private JSONObject readJsonAsset(@NonNull String assetName) throws Exception {
    try (InputStream input = getAssets().open(assetName)) {
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      byte[] buffer = new byte[4096];
      int count;
      while ((count = input.read(buffer)) != -1) {
        if (output.size() + count > MAX_DEV_SESSION_BYTES) {
          throw new IllegalStateException("Dev shell contract exceeds size limit");
        }
        output.write(buffer, 0, count);
      }
      return new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
    }
  }

  @NonNull
  private JSONObject readJsonFile(@NonNull File file, long maxBytes) throws Exception {
    if (!file.isFile() || file.length() <= 0 || file.length() > maxBytes) {
      throw new IllegalStateException(
        "DevSession file is missing or exceeds size limit: " + file.getName()
      );
    }
    try (
      InputStream input = new FileInputStream(file);
      ByteArrayOutputStream output = new ByteArrayOutputStream()
    ) {
      byte[] buffer = new byte[8192];
      int count;
      long received = 0;
      while ((count = input.read(buffer)) != -1) {
        received += count;
        if (received > maxBytes) {
          throw new IllegalStateException("DevSession file exceeds size limit");
        }
        output.write(buffer, 0, count);
      }
      return new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
    }
  }

  @NonNull
  private String validateMetroBaseUrl(@NonNull String value) {
    Uri uri = Uri.parse(value);
    String scheme = uri.getScheme();
    if (
      !("http".equals(scheme) || "https".equals(scheme)) ||
      uri.getHost() == null ||
      uri.getHost().isEmpty() ||
      uri.getUserInfo() != null ||
      (uri.getPath() != null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath())) ||
      uri.getQuery() != null ||
      uri.getFragment() != null
    ) {
      throw new IllegalStateException("DevSession Metro URL must be an HTTP(S) origin");
    }
    return value.replaceAll("/$", "");
  }

  @NonNull
  private String buildDevVendorEntryUrl(
    @NonNull String metroBaseUrl,
    @NonNull String sessionId,
    @NonNull String runtimeTarget,
    @NonNull String fingerprint
  ) {
    String bundlePath = "background".equals(runtimeTarget)
      ? "background.bundle"
      : ".expo/.virtual-metro-entry.bundle";
    Uri.Builder builder = Uri.parse(metroBaseUrl).buildUpon()
      .path(bundlePath)
      .appendQueryParameter("platform", "android")
      .appendQueryParameter("dev", "true")
      .appendQueryParameter("lazy", "false")
      .appendQueryParameter("minify", "false")
      .appendQueryParameter("inlineSourceMap", "false")
      .appendQueryParameter("modulesOnly", "true")
      .appendQueryParameter("runModule", "true")
      .appendQueryParameter("resolver.devVendor", "true")
      .appendQueryParameter("resolver.devVendorNative", "true")
      .appendQueryParameter("resolver.devVendorFingerprint", fingerprint)
      .appendQueryParameter("resolver.devSessionId", sessionId)
      .appendQueryParameter("resolver.runtimeTarget", runtimeTarget)
      .appendQueryParameter("unstable_transformProfile", "hermes-stable");
    if ("background".equals(runtimeTarget) && BuildConfig.ONEKEY_DEV_BG_HMR) {
      builder.appendQueryParameter("resolver.devVendorBackgroundHMR", "true");
    }
    return builder.build().toString();
  }

  @Override
  protected synchronized void configureBuildVariantRuntime() {
    if (!BuildConfig.ONEKEY_DEV_SHELL) {
      return;
    }
    if (buildVariantBundleInfo != null) {
      return;
    }
    try {
      JSONObject contract = readJsonAsset(DEV_SHELL_CONTRACT_ASSET);
      File sessionRoot = new File(getFilesDir(), DEV_SESSION_ROOT);
      JSONObject current = readJsonFile(
        new File(sessionRoot, "current.json"),
        MAX_DEV_SESSION_BYTES
      );
      String sessionId = current.optString("sessionId");
      String deviceId = current.optString("deviceId");
      String worktreeId = current.optString("worktreeId");
      if (
        current.optInt("schemaVersion", -1) != 1 ||
        !DEV_SESSION_ID_PATTERN.matcher(sessionId).matches() ||
        deviceId.isEmpty() ||
        !worktreeId.matches("^[0-9a-f]{12}$") ||
        !sessionId.startsWith("wk-" + worktreeId + "-")
      ) {
        throw new IllegalStateException("Android dev shell current session pointer is invalid");
      }
      File sessionDirectory = new File(sessionRoot, sessionId);
      String rootPath = sessionRoot.getCanonicalPath() + File.separator;
      if (!sessionDirectory.getCanonicalPath().startsWith(rootPath)) {
        throw new IllegalStateException("Android dev shell session path escapes its private root");
      }
      JSONObject session = readJsonFile(
        new File(sessionDirectory, "session.json"),
        MAX_DEV_SESSION_BYTES
      );
      JSONObject sessionVendor = session.getJSONObject("vendor");
      JSONObject metro = session.getJSONObject("metro");
      String nativeContractKey = contract.optString("nativeContractKey");
      String sessionContractKey = session.optString("nativeContractKey");
      if (
        contract.optInt("schemaVersion", -1) != 1 ||
        !"android".equals(contract.optString("platform")) ||
        session.optInt("schemaVersion", -1) != 2 ||
        !"android".equals(session.optString("platform")) ||
        !sessionId.equals(session.optString("sessionId")) ||
        !deviceId.equals(session.optString("deviceId")) ||
        !worktreeId.equals(session.optString("worktreeId")) ||
        !DEV_VENDOR_FINGERPRINT_PATTERN.matcher(nativeContractKey).matches() ||
        !nativeContractKey.equals(sessionContractKey) ||
        session.optLong("expiresAtEpochMs", -1L) <= System.currentTimeMillis()
      ) {
        throw new IllegalStateException("DevSession does not match this Android shell");
      }
      if (
        !"vendor-manifest.json".equals(sessionVendor.optString("manifestFile")) ||
        !"common.hbc".equals(sessionVendor.optString("commonHbcFile"))
      ) {
        throw new IllegalStateException("DevSession uses unsupported private file names");
      }
      String metroBaseUrl = validateMetroBaseUrl(metro.getString("baseUrl"));
      JSONObject manifest = readJsonFile(
        new File(sessionDirectory, "vendor-manifest.json"),
        MAX_DEV_SESSION_BYTES
      );
      String fingerprint = manifest.optString("fingerprint");
      JSONObject bytecode = manifest.getJSONObject("common").getJSONObject("bytecode");
      long expectedBytes = bytecode.optLong("bytes", -1L);
      String expectedSha256 = bytecode.optString("sha256");
      if (
        manifest.optInt("schemaVersion", -1) != contract.optInt("vendorSchemaVersion", -2) ||
        manifest.optInt("strategyVersion", -1) != contract.optInt("vendorStrategyVersion", -2) ||
        !"android".equals(manifest.optString("platform")) ||
        !nativeContractKey.equals(manifest.optString("nativeContractKey")) ||
        !nativeContractKey.equals(sessionVendor.optString("nativeContractKey")) ||
        sessionVendor.optInt("schemaVersion", -1) != manifest.optInt("schemaVersion", -2) ||
        sessionVendor.optInt("strategyVersion", -1) != manifest.optInt("strategyVersion", -2) ||
        !fingerprint.equals(sessionVendor.optString("fingerprint")) ||
        !DEV_VENDOR_FINGERPRINT_PATTERN.matcher(fingerprint).matches() ||
        !"common.hbc".equals(bytecode.optString("file")) ||
        expectedBytes <= 0 ||
        !DEV_VENDOR_FINGERPRINT_PATTERN.matcher(expectedSha256).matches() ||
        !expectedSha256.equals(sessionVendor.optString("commonHbcSha256"))
      ) {
        throw new IllegalStateException("DevSession vendor manifest is incompatible");
      }
      File commonFile = new File(sessionDirectory, "common.hbc");
      if (
        !commonFile.isFile() ||
        commonFile.length() != expectedBytes ||
        commonFile.length() > MAX_DEV_VENDOR_BYTES ||
        !expectedSha256.equals(sha256File(commonFile))
      ) {
        throw new IllegalStateException("DevSession private common.hbc integrity mismatch");
      }
      buildVariantBundleInfo = new BuildVariantBundleInfo(
        commonFile.getAbsolutePath(),
        fingerprint,
        buildDevVendorEntryUrl(metroBaseUrl, sessionId, "main", fingerprint),
        buildDevVendorEntryUrl(metroBaseUrl, sessionId, "background", fingerprint)
      );
      OneKeyLog.info(
        "DevVendor",
        "configured private Android dev vendor session=" + sessionId
          + " fingerprint=" + fingerprint
      );
    } catch (Exception error) {
      throw new IllegalStateException(
        "Unable to configure Android DevSession from app-private storage. "
          + "Run the dev-shell command again for this exact emulator.",
        error
      );
    }
  }

  @Nullable
  @Override
  protected synchronized BuildVariantBundleInfo getBuildVariantBundleInfo() {
    if (!BuildConfig.ONEKEY_DEV_SHELL) {
      return null;
    }
    if (buildVariantBundleInfo == null) {
      throw new IllegalStateException("Android dev shell has no configured DevSession");
    }
    return buildVariantBundleInfo;
  }

  @Override
  protected boolean startBuildVariantBackgroundRunner(
    @NonNull BackgroundThreadManager manager,
    @NonNull BuildVariantBundleInfo bundleInfo
  ) {
    return manager.ensureBackgroundRunnerWithDevVendor(
      getApplicationContext(),
      bundleInfo.backgroundEntryUrl,
      bundleInfo.commonBundlePath,
      bundleInfo.fingerprint,
      BuildConfig.ONEKEY_DEV_BG_HMR
    );
  }
}
