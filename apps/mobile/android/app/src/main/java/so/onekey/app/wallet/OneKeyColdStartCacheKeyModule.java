package so.onekey.app.wallet;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class OneKeyColdStartCacheKeyModule extends ReactContextBaseJavaModule {
  private static final String MODULE_NAME = "OneKeyColdStartCacheKey";
  private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
  private static final String KEY_ALIAS = "onekey_cold_start_cache_key_wrap_v1";
  private static final String PREFS_NAME = "onekey_cold_start_cache_key";
  private static final String PREF_CIPHER_TEXT = "cipher_text";
  private static final String PREF_IV = "iv";
  private static final int GCM_TAG_BITS = 128;
  private static final int KEY_BYTES = 32;

  public OneKeyColdStartCacheKeyModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return MODULE_NAME;
  }

  @Nullable
  @Override
  public Map<String, Object> getConstants() {
    Map<String, Object> constants = new HashMap<>();
    constants.put("encryptionKey", getOrCreateEncryptionKey(getReactApplicationContext()));
    return constants;
  }

  private static String getOrCreateEncryptionKey(Context context) {
    SharedPreferences prefs =
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    String cipherText = prefs.getString(PREF_CIPHER_TEXT, null);
    String iv = prefs.getString(PREF_IV, null);
    if (cipherText != null && iv != null) {
      String decrypted = decrypt(cipherText, iv);
      if (decrypted != null && !decrypted.isEmpty()) {
        return decrypted;
      }
    }

    String next = createRandomKey();
    String[] encrypted = encrypt(next);
    if (encrypted != null) {
      boolean saved = prefs
        .edit()
        .putString(PREF_CIPHER_TEXT, encrypted[0])
        .putString(PREF_IV, encrypted[1])
        .commit();
      if (saved) {
        return next;
      }
    }
    return "";
  }

  private static String createRandomKey() {
    byte[] bytes = new byte[KEY_BYTES];
    new SecureRandom().nextBytes(bytes);
    return Base64.encodeToString(bytes, Base64.NO_WRAP);
  }

  @Nullable
  private static String[] encrypt(String value) {
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, getOrCreateWrappingKey());
      byte[] cipherBytes = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
      return new String[] {
        Base64.encodeToString(cipherBytes, Base64.NO_WRAP),
        Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
      };
    } catch (Exception ignored) {
      return null;
    }
  }

  @Nullable
  private static String decrypt(String cipherText, String iv) {
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(
        Cipher.DECRYPT_MODE,
        getOrCreateWrappingKey(),
        new GCMParameterSpec(GCM_TAG_BITS, Base64.decode(iv, Base64.NO_WRAP))
      );
      byte[] plainBytes = cipher.doFinal(Base64.decode(cipherText, Base64.NO_WRAP));
      return new String(plainBytes, StandardCharsets.UTF_8);
    } catch (Exception ignored) {
      return null;
    }
  }

  private static SecretKey getOrCreateWrappingKey() throws Exception {
    KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
    keyStore.load(null);
    if (!keyStore.containsAlias(KEY_ALIAS)) {
      KeyGenerator keyGenerator =
        KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
      KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .build();
      keyGenerator.init(spec);
      keyGenerator.generateKey();
    }
    return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
  }
}
