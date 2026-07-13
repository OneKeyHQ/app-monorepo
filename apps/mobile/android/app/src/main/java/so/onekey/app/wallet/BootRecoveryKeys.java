package so.onekey.app.wallet;

final class BootRecoveryKeys {
    static final String PREFS_NAME = "onekey_recovery";
    // Activity-stage counter: incremented in MainActivity.onCreate, reset on
    // graceful onStop / RecoveryActivity / JS markBootSuccess. Also serves
    // as a freshness signal for BOOT_FAIL_TIMESTAMPS — when 0, the timestamps
    // list is considered stale (some reset path zeroed it, but the Nitro
    // `markBootSuccess` in node_modules only writes this integer, so we
    // piggy-back the "list invalidated" signal on integer == 0 rather than
    // requiring every reset site to clear two keys).
    //
    // Application-stage crashes (SoLoader / NewArch / Expo / JPush register)
    // are intentionally NOT tracked here — those are extremely rare in
    // practice, and when they DO happen they are usually permanent
    // (corrupted .so / ABI mismatch) rather than transient crash-loops that
    // a "clear cache" recovery flow could repair. Counting them adds
    // mental complexity (two-stage counters, two reset semantics) for
    // negligible production value.
    static final String CONSECUTIVE_BOOT_FAIL_COUNT = "consecutive_boot_fail_count";
    // Comma-separated MainActivity.onCreate timestamps used by
    // BootRecoveryStore to compute a TIME-WINDOWED failure count. Without
    // this, Activity recreations that are NOT consecutive-in-time (memory-
    // pressure resurrection hours later, locale/fontScale config change
    // bursts, appRestart-driven recreations racing with the 5s JS
    // markBootSuccess timer) all ratchet `consecutive_boot_fail_count`
    // toward recovery even though there was no actual crash loop.
    static final String BOOT_FAIL_TIMESTAMPS = "boot_fail_timestamps";
    static final String BOOT_FAIL_APP_VERSION = "boot_fail_app_version";
    static final String RECOVERY_ACTION = "recovery_action";
    static final int RECOVERY_THRESHOLD = 3;
    // 10-minute sliding window. RN init crash-loops fire within seconds;
    // any restarts spaced further apart than this are almost certainly not
    // a crash loop.
    static final long ACTIVITY_FAIL_WINDOW_MS = 10L * 60L * 1000L;

    private BootRecoveryKeys() {}
}
