package so.onekey.app.wallet.splashscreen;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import java.lang.ref.WeakReference;

public class SplashScreenViewController {
    private static final long SEARCH_FOR_ROOT_VIEW_INTERVAL = 20L;

    private final WeakReference<Activity> weakActivity;
    private final ViewGroup contentView;
    private final Class<? extends ViewGroup> rootViewClass;
    private final View splashScreenView;
    private final Handler handler;

    private boolean autoHideEnabled = true;
    private boolean splashScreenShown = false;
    private ViewGroup rootView = null;

    public SplashScreenViewController(
            Activity activity,
            Class<? extends ViewGroup> rootViewClass,
            View splashScreenView) {
        this.weakActivity = new WeakReference<>(activity);
        this.rootViewClass = rootViewClass;
        this.splashScreenView = splashScreenView;
        this.contentView = activity.findViewById(android.R.id.content);
        if (this.contentView == null) {
            throw new Error("ContentView is not yet available. Call 'SplashScreen.show(...)' once 'setContentView()' is called.");
        }
        this.handler = new Handler(Looper.getMainLooper());
    }

    // region public lifecycle

    public void showSplashScreen(Runnable successCallback) {
        Activity activity = weakActivity.get();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                ViewGroup parent = (ViewGroup) splashScreenView.getParent();
                if (parent != null) {
                    parent.removeView(splashScreenView);
                }
                contentView.addView(splashScreenView);
                splashScreenShown = true;
                if (successCallback != null) {
                    successCallback.run();
                }
                searchForRootView();
            });
        }
    }

    public void showSplashScreen() {
        showSplashScreen(null);
    }

    public void preventAutoHide() {
        autoHideEnabled = false;
    }

    public void hideSplashScreen(
            OnSuccessCallback<Boolean> successCallback,
            OnFailureCallback failureCallback) {
        if (!splashScreenShown) {
            if (successCallback != null) {
                successCallback.onSuccess(false);
            }
            return;
        }

        // activity SHOULD be present at this point - if it's not, it means that application is already dead
        Activity activity = weakActivity.get();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            if (failureCallback != null) {
                failureCallback.onFailure("Cannot hide native splash screen on activity that is already destroyed (application is already closed).");
            }
            return;
        }

        new Handler(activity.getMainLooper()).post(() -> {
            contentView.removeView(splashScreenView);
            autoHideEnabled = true;
            splashScreenShown = false;
            if (successCallback != null) {
                successCallback.onSuccess(true);
            }
        });
    }

    public void hideSplashScreen() {
        hideSplashScreen(null, null);
    }

    // endregion

    /**
     * Searches for RootView that conforms to class given via SplashScreen.show.
     * If rootView is already found this method is noop.
     */
    private void searchForRootView() {
        if (rootView != null) {
            return;
        }
        // RootView is successfully found in first check (nearly impossible for first call)
        ViewGroup foundRootView = findRootView(contentView);
        if (foundRootView != null) {
            handleRootView(foundRootView);
            return;
        }
        handler.postDelayed(this::searchForRootView, SEARCH_FOR_ROOT_VIEW_INTERVAL);
    }

    private ViewGroup findRootView(View view) {
        if (rootViewClass.isInstance(view)) {
            return (ViewGroup) view;
        }
        if (view != splashScreenView && view instanceof ViewGroup) {
            ViewGroup viewGroup = (ViewGroup) view;
            for (int idx = 0; idx < viewGroup.getChildCount(); idx++) {
                ViewGroup found = findRootView(viewGroup.getChildAt(idx));
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    private void handleRootView(ViewGroup view) {
        rootView = view;
        if ((rootView != null ? rootView.getChildCount() : 0) > 0) {
            if (autoHideEnabled) {
                hideSplashScreen();
            }
        }
        view.setOnHierarchyChangeListener(new ViewGroup.OnHierarchyChangeListener() {
            @Override
            public void onChildViewRemoved(View parent, View child) {
                // TODO: ensure mechanism for detecting reloading view hierarchy works (reload button)
                if (rootView != null && rootView.getChildCount() == 0) {
                    showSplashScreen();
                }
            }

            @Override
            public void onChildViewAdded(View parent, View child) {
                // react only to first child
                if (rootView != null && rootView.getChildCount() == 1) {
                    if (autoHideEnabled) {
                        hideSplashScreen();
                    }
                }
            }
        });
    }

    public interface OnSuccessCallback<T> {
        void onSuccess(T result);
    }

    public interface OnFailureCallback {
        void onFailure(String reason);
    }
} 
