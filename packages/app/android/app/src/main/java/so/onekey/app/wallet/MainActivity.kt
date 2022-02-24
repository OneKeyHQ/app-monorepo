package so.onekey.app.wallet

import android.content.Intent;
import android.os.Bundle
import com.facebook.react.ReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper
import com.facebook.react.ReactRootView
import expo.modules.devlauncher.DevLauncherController;
import expo.modules.devmenu.react.DevMenuAwareReactActivity;
import com.swmansion.gesturehandler.react.RNGestureHandlerEnabledRootView
import expo.modules.devlauncher.launcher.DevLauncherReactActivityDelegateSupplier

class MainActivity : DevMenuAwareReactActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Set the theme to AppTheme BEFORE onCreate to support
        // coloring the background, status bar, and navigation bar.
        // This is required for expo-splash-screen.
        setTheme(R.style.AppTheme)
        super.onCreate(null)
    }

    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    override fun getMainComponentName(): String? {
        return "main"
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        if (BuildConfig.ENABLE_DEV_CLI) {
            return DevLauncherController.wrapReactActivityDelegate(
                    this,
                    object : DevLauncherReactActivityDelegateSupplier {
                        override fun get() = object : ReactActivityDelegate(this@MainActivity, mainComponentName) {
                            override fun createRootView() = RNGestureHandlerEnabledRootView(this@MainActivity)
                        }
                    }
            )
        }

        return ReactActivityDelegateWrapper(
                this,
                object : ReactActivityDelegate(this, mainComponentName) {
                    override fun createRootView(): ReactRootView {
                        return RNGestureHandlerEnabledRootView(this@MainActivity)
                    }
                })
    }

    @Override
    override fun onNewIntent(intent: Intent) {
        if (BuildConfig.ENABLE_DEV_CLI) {
            if (DevLauncherController.tryToHandleIntent(this, intent)) {
                return;
            }
        }

        super.onNewIntent(intent);
    }
}