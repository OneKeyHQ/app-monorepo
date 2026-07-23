package so.onekey.test.skeletonchurn

import android.app.Activity
import android.os.Bundle
import android.widget.FrameLayout

class SkeletonChurnActivity : Activity() {
  lateinit var rootView: FrameLayout
    private set

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    rootView = FrameLayout(this)
    setContentView(rootView)
  }
}
