package so.onekey.test.skeletonchurn

import android.app.Application
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.margelo.nitro.JNIOnLoad
import com.margelo.nitro.skeleton.SkeletonPackage

class SkeletonChurnApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    DefaultNewArchitectureEntryPoint.load()
    JNIOnLoad.initializeNativeNitro()
    SkeletonPackage()
  }
}
