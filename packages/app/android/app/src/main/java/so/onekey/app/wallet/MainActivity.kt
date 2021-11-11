package so.onekey.app.wallet

import com.facebook.react.ReactActivity
import android.os.Bundle
import com.facebook.react.ReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper
import com.facebook.react.ReactRootView
import com.swmansion.gesturehandler.react.RNGestureHandlerEnabledRootView

class MainActivity : ReactActivity() {
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
        return ReactActivityDelegateWrapper(
                this,
                object : ReactActivityDelegate(this, mainComponentName) {
                    override fun createRootView(): ReactRootView {
                        return RNGestureHandlerEnabledRootView(this@MainActivity)
                    }
                })
    }
}