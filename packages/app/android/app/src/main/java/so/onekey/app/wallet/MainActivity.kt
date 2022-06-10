package so.onekey.app.wallet

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactRootView
import expo.modules.ReactActivityDelegateWrapper


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


    /**
     * Returns the instance of the [ReactActivityDelegate]. There the RootView is created and
     * you can specify the rendered you wish to use (Fabric or the older renderer).
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate? {
        return ReactActivityDelegateWrapper(this, MainActivityDelegate(this, mainComponentName))
    }

    class MainActivityDelegate(activity: ReactActivity?, mainComponentName: String?) :
        ReactActivityDelegate(activity, mainComponentName) {
        override fun createRootView(): ReactRootView {
            val reactRootView = ReactRootView(context)
            // If you opted-in for the New Architecture, we enable the Fabric Renderer.
            reactRootView.setIsFabric(BuildConfig.IS_NEW_ARCHITECTURE_ENABLED)
            return reactRootView
        }
    }
}