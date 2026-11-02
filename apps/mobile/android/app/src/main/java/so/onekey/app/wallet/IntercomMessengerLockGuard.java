package so.onekey.app.wallet;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Set;
import java.util.WeakHashMap;

/**
 * The Intercom Messenger runs in its own Activities, which keeps the React
 * activity paused. Returning from background straight into the Messenger
 * would skip the AppState-driven app lock check. JS supplies the lock window
 * computed by the shared auto-lock rule, so an unexpired session can keep
 * picker/camera results without waiting for paused RN timers. After process death the
 * system may restore a stack of Messenger Activities before the wallet exists,
 * so close all of them until the wallet has resumed.
 */
final class IntercomMessengerLockGuard implements Application.ActivityLifecycleCallbacks {
  private final Set<Activity> messengerActivities =
      Collections.newSetFromMap(new WeakHashMap<>());
  private int startedActivities = 0;
  private boolean returningFromBackground = false;
  private boolean walletHasResumed = false;
  private boolean policyReady = false;
  private boolean locked = true;
  private double validFromMs = 0;
  private double lockAtMs = 0;

  // Called on the UI thread, just like the Activity lifecycle callbacks.
  void updateLockPolicy(boolean locked, double validFromMs, double lockAtMs) {
    this.locked = locked;
    this.validFromMs = validFromMs;
    this.lockAtMs = lockAtMs;
    this.policyReady = true;
    if (locked) {
      closeMessengerActivities();
    }
  }

  boolean shouldLock(double now) {
    return !policyReady || locked || now < validFromMs || now >= lockAtMs;
  }

  private void closeMessengerActivities() {
    for (Activity messenger : new ArrayList<>(messengerActivities)) {
      messenger.finish();
    }
  }

  static boolean isMessengerActivity(@NonNull Activity activity) {
    return activity.getClass().getName().startsWith("io.intercom.");
  }

  @Override
  public void onActivityCreated(@NonNull Activity activity, @Nullable Bundle savedInstanceState) {
    if (isMessengerActivity(activity)) {
      messengerActivities.add(activity);
      if (!walletHasResumed) {
        activity.finish();
      }
    }
  }

  @Override
  public void onActivityStarted(@NonNull Activity activity) {
    startedActivities += 1;
    if (returningFromBackground && isMessengerActivity(activity)) {
      if (shouldLock(System.currentTimeMillis())) {
        closeMessengerActivities();
      }
      returningFromBackground = false;
    }
  }

  @Override
  public void onActivityStopped(@NonNull Activity activity) {
    startedActivities = Math.max(0, startedActivities - 1);
    if (startedActivities == 0 && !activity.isChangingConfigurations()) {
      returningFromBackground = true;
    }
  }

  @Override
  public void onActivityDestroyed(@NonNull Activity activity) {
    messengerActivities.remove(activity);
  }

  @Override
  public void onActivityResumed(@NonNull Activity activity) {
    if (activity instanceof MainActivity) {
      walletHasResumed = true;
      returningFromBackground = false;
    }
  }
  @Override public void onActivityPaused(@NonNull Activity activity) {}
  @Override public void onActivitySaveInstanceState(@NonNull Activity activity, @NonNull Bundle outState) {}
}
