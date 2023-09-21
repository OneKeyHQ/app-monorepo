package so.onekey.app.wallet


import android.content.Context
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.util.DisplayMetrics
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper
import so.onekey.app.wallet.utils.sendEvent


class MainActivity : ReactActivity() {

    companion object {
        private const val ANDROID_LIFECYCLE_EVENT = "android_lifecycle"

        fun isTabletOrFoldable(context: Context): Boolean {
            val metrics: DisplayMetrics = context.resources.displayMetrics
            val yInches = metrics.heightPixels / metrics.ydpi
            val xInches = metrics.widthPixels / metrics.xdpi
            val diagonalInches = Math.sqrt((xInches * xInches + yInches * yInches).toDouble())
            return diagonalInches >= 7.0
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Set the theme to AppTheme BEFORE onCreate to support
        // coloring the background, status bar, and navigation bar.
        // This is required for expo-splash-screen.
        setTheme(R.style.AppTheme)
        super.onCreate(null)

        requestedOrientation = if (isTabletOrFoldable(this)) {
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        } else {
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }
    }

    override fun onResume() {
        super.onResume()
        reactInstanceManager.currentReactContext?.let {
            sendEvent(it, ANDROID_LIFECYCLE_EVENT, "active")
        }
    }

    override fun onRestart() {
        super.onRestart()
        reactInstanceManager.currentReactContext?.let {
            sendEvent(it, ANDROID_LIFECYCLE_EVENT, "inactive")
        }
    }

    override fun onStop() {
        reactInstanceManager.currentReactContext?.let {
            sendEvent(it, ANDROID_LIFECYCLE_EVENT, "background")
        }
        super.onStop()
    }

    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    override fun getMainComponentName(): String {
        return "main"
    }


    /**
     * Returns the instance of the [ReactActivityDelegate]. There the RootView is created and
     * you can specify the rendered you wish to use (Fabric or the older renderer).
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate? {
        return ReactActivityDelegateWrapper(
            this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, DefaultReactActivityDelegate(
                this,
                mainComponentName,  // If you opted-in for the New Architecture, we enable the Fabric Renderer.
                DefaultNewArchitectureEntryPoint.fabricEnabled,  // fabricEnabled
                // If you opted-in for the New Architecture, we enable Concurrent React (i.e. React 18).
                DefaultNewArchitectureEntryPoint.concurrentReactEnabled // concurrentRootEnabled
            )
        )
    }

}