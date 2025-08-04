package so.onekey.app.wallet.splashscreen.singletons;

import android.app.Activity;
import android.view.View;
import android.view.ViewGroup;
import expo.modules.core.interfaces.SingletonModule;
import so.onekey.app.wallet.splashscreen.*;

import java.util.WeakHashMap;

public class SplashScreen implements SingletonModule {
    private static final String TAG = "SplashScreen";
    public static final SplashScreen INSTANCE = new SplashScreen();

    private final WeakHashMap<Activity, SplashScreenViewController> controllers = new WeakHashMap<>();

    private SplashScreen() {
        // Private constructor for singleton
    }

    private boolean isAlreadyHidden = false;

    @Override
    public String getName() {
        return "SplashScreen";
    }

    /**
     * Show SplashScreen by mounting it in ContentView.
     *
     * Use this call only if you're providing custom SplashScreenViewProvider, otherwise use default SplashScreen.show.
     *
     * @param activity Target Activity for SplashScreen to be mounted in.
     * @param splashScreenViewProvider Provider that created properly configured SplashScreenView
     * @param rootViewClass Class that is looked for in view hierarchy while autohiding is enabled.
     * @param statusBarTranslucent Flag determining StatusBar translucency in a way ReactNative see it.
     * @param successCallback Callback to be called once SplashScreen is mounted in view hierarchy.
     * @param failureCallback Callback to be called once SplashScreen cannot be mounted.
     */
    public void show(
            Activity activity,
            SplashScreenViewProvider splashScreenViewProvider,
            Class<? extends ViewGroup> rootViewClass,
            boolean statusBarTranslucent,
            Runnable successCallback,
            OnFailureCallback failureCallback) {
        SplashScreenStatusBar.INSTANCE.configureTranslucent(activity, statusBarTranslucent);

        View splashView = splashScreenViewProvider.createSplashScreenView(activity);
        SplashScreenViewController controller = null;
        try {
            controller = new SplashScreenViewController(activity, rootViewClass, splashView);
            show(activity, controller, statusBarTranslucent, successCallback, failureCallback);
        } catch (Error e) {
            // throw new RuntimeException(e);
        }
    }

    public void show(
            Activity activity,
            SplashScreenViewProvider splashScreenViewProvider,
            Class<? extends ViewGroup> rootViewClass,
            boolean statusBarTranslucent) {
        show(activity, splashScreenViewProvider, rootViewClass, statusBarTranslucent, null, null);
    }

    /**
     * Show SplashScreen by mounting it in ContentView.
     *
     * Default method for mounting SplashScreen in your app.
     *
     * @param activity Target Activity for SplashScreen to be mounted in.
     * @param resizeMode SplashScreen imageView resizeMode.
     * @param rootViewClass Class that is looked for in view hierarchy while autohiding is enabled.
     * @param statusBarTranslucent Flag determining StatusBar translucency in a way ReactNative see it.
     * @param splashScreenViewProvider
     * @param successCallback Callback to be called once SplashScreen is mounted in view hierarchy.
     * @param failureCallback Callback to be called once SplashScreen cannot be mounted.
     */
    public void show(
            Activity activity,
            SplashScreenImageResizeMode resizeMode,
            Class<? extends ViewGroup> rootViewClass,
            boolean statusBarTranslucent,
            SplashScreenViewProvider splashScreenViewProvider,
            Runnable successCallback,
            OnFailureCallback failureCallback) {
        show(activity, splashScreenViewProvider, rootViewClass, statusBarTranslucent, successCallback, failureCallback);
    }

    public void show(
            Activity activity,
            SplashScreenImageResizeMode resizeMode,
            Class<? extends ViewGroup> rootViewClass,
            boolean statusBarTranslucent,
            SplashScreenViewProvider splashScreenViewProvider) {
        show(activity, splashScreenViewProvider, rootViewClass, statusBarTranslucent, null, null);
    }

    public void show(
            Activity activity,
            SplashScreenImageResizeMode resizeMode,
            Class<? extends ViewGroup> rootViewClass,
            boolean statusBarTranslucent) {
        show(activity, resizeMode, rootViewClass, statusBarTranslucent, new NativeResourcesBasedSplashScreenViewProvider(resizeMode));
    }

    /**
     * Show SplashScreen by mounting it in ContentView.
     *
     * Default method for mounting SplashScreen in your app.
     *
     * @param activity Target Activity for SplashScreen to be mounted in.
     * @param splashScreenViewController SplashScreenViewController to manage the rootView and splashView
     * @param statusBarTranslucent Flag determining StatusBar translucency in a way ReactNative see it.
     * @param successCallback Callback to be called once SplashScreen is mounted in view hierarchy.
     * @param failureCallback Callback to be called once SplashScreen cannot be mounted.
     */
    public void show(
            Activity activity,
            SplashScreenViewController splashScreenViewController,
            boolean statusBarTranslucent,
            Runnable successCallback,
            OnFailureCallback failureCallback) {
        if (isAlreadyHidden) {
            return;
        }
        // SplashScreen.show can only be called once per activity
        if (controllers.containsKey(activity)) {
            if (failureCallback != null) {
                failureCallback.onFailure("'SplashScreen.show' has already been called for this activity.");
            }
            return;
        }

        SplashScreenStatusBar.INSTANCE.configureTranslucent(activity, statusBarTranslucent);

        controllers.put(activity, splashScreenViewController);
        splashScreenViewController.showSplashScreen(successCallback);
    }

    public void show(
            Activity activity,
            SplashScreenViewController splashScreenViewController,
            boolean statusBarTranslucent) {
        show(activity, splashScreenViewController, statusBarTranslucent, null, null);
    }

    /**
     * Prevents SplashScreen from autoHiding once App View Hierarchy is mounted for given activity.
     * @param successCallback Callback to be called once SplashScreen could be successfully prevented from autohinding.
     * @param failureCallback Callback to be called upon failure in preventing SplashScreen from autohiding.
     */
    public void preventAutoHide(
            Activity activity,
            OnSuccessCallback<Boolean> successCallback,
            OnFailureCallback failureCallback) {
        if (!controllers.containsKey(activity)) {
            if (failureCallback != null) {
                failureCallback.onFailure("No native splash screen registered for provided activity. Please configure your application's main Activity to call 'SplashScreen.show' (https://github.com/expo/expo/tree/main/packages/expo-splash-screen#-configure-android).");
            }
            return;
        }

        SplashScreenViewController controller = controllers.get(activity);
        if (controller != null) {
            controller.preventAutoHide();
        }
    }

    public void preventAutoHide(Activity activity) {
        preventAutoHide(activity, null, null);
    }

    /**
     * Hides SplashScreen for given activity.
     * @param successCallback Callback to be called once SplashScreen is removed from view hierarchy.
     * @param failureCallback Callback to be called upon failure in hiding SplashScreen.
     */
    public void hide(
            Activity activity,
            OnSuccessCallback<Boolean> successCallback,
            OnFailureCallback failureCallback) {
        isAlreadyHidden = true;
        if (!controllers.containsKey(activity)) {
            if (failureCallback != null) {
                failureCallback.onFailure("No native splash screen registered for provided activity. Please configure your application's main Activity to call 'SplashScreen.show' (https://github.com/expo/expo/tree/main/packages/expo-splash-screen#-configure-android).");
            }
            return;
        }

        SplashScreenViewController controller = controllers.get(activity);
        if (controller != null) {
            controller.hideSplashScreen();
        }
    }

    public void hide(Activity activity) {

        hide(activity, null, null);
    }

    public interface OnSuccessCallback<T> {
        void onSuccess(T result);
    }

    public interface OnFailureCallback {
        void onFailure(String reason);
    }
} 
