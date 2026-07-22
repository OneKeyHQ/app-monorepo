@file:Suppress("DEPRECATION")

package so.onekey.test.skeletonchurn

import android.os.Bundle
import android.os.Debug
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.widget.FrameLayout
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.skeleton.views.HybridSkeletonManager
import kotlin.math.max
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class HybridSkeletonLifecycleChurnTest {
  @get:Rule
  val activityRule = ActivityScenarioRule(SkeletonChurnActivity::class.java)

  @Test(timeout = TEST_TIMEOUT_MILLIS)
  fun dropsThirtyThousandAttachedSkeletonViewsWithoutGlobalRefGrowth() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    lateinit var manager: ExposedHybridSkeletonManager
    lateinit var themedReactContext: ThemedReactContext

    activityRule.scenario.onActivity { activity ->
      val reactApplicationContext = BridgeReactContext(activity.applicationContext)
      themedReactContext =
        ThemedReactContext(
          reactApplicationContext,
          activity,
          "SkeletonChurnHarness",
          1,
        )
      manager = ExposedHybridSkeletonManager()
    }

    repeat(WARM_UP_ITERATIONS / BATCH_SIZE) {
      churnViews(manager, themedReactContext, BATCH_SIZE)
    }
    collectGarbage(instrumentation)
    val baselineGlobalRefs = readJniGlobalRefCount()
    var peakGlobalRefs = baselineGlobalRefs
    var completedIterations = 0

    repeat(MEASURED_ITERATIONS / BATCH_SIZE) { batchIndex ->
      churnViews(manager, themedReactContext, BATCH_SIZE)
      completedIterations += BATCH_SIZE

      if ((batchIndex + 1) % GLOBAL_REF_SAMPLE_BATCHES == 0) {
        readJniGlobalRefCount()?.let { current ->
          peakGlobalRefs = max(peakGlobalRefs ?: current, current)
        }
      }
    }

    collectGarbage(instrumentation)
    val finalGlobalRefs = readJniGlobalRefCount()
    finalGlobalRefs?.let { current ->
      peakGlobalRefs = max(peakGlobalRefs ?: current, current)
    }
    assertEquals(MEASURED_ITERATIONS, completedIterations)

    val metrics =
      Bundle().apply {
        putInt("skeletonChurnIterations", completedIterations)
        putString("jniGlobalRefsBaseline", baselineGlobalRefs?.toString() ?: "UNAVAILABLE")
        putString("jniGlobalRefsPeak", peakGlobalRefs?.toString() ?: "UNAVAILABLE")
        putString("jniGlobalRefsFinal", finalGlobalRefs?.toString() ?: "UNAVAILABLE")
      }
    instrumentation.sendStatus(0, metrics)
    Log.i(TAG, metrics.toString())

    if (baselineGlobalRefs != null && peakGlobalRefs != null) {
      val peakDelta = peakGlobalRefs - baselineGlobalRefs
      assertTrue(
        "JNI global refs grew by $peakDelta; allowed delta is $MAX_GLOBAL_REF_DELTA",
        peakDelta <= MAX_GLOBAL_REF_DELTA,
      )
    }
  }

  private fun churnViews(
    manager: ExposedHybridSkeletonManager,
    themedReactContext: ThemedReactContext,
    iterations: Int,
  ) {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val views = ArrayList<View>(BATCH_SIZE)

    activityRule.scenario.onActivity { activity ->
      repeat(iterations) {
        val view = manager.createForTest(themedReactContext)
        view.layoutParams = FrameLayout.LayoutParams(VIEW_SIZE_PX, VIEW_SIZE_PX)
        activity.rootView.addView(view)
        view.measure(
          View.MeasureSpec.makeMeasureSpec(VIEW_SIZE_PX, View.MeasureSpec.EXACTLY),
          View.MeasureSpec.makeMeasureSpec(VIEW_SIZE_PX, View.MeasureSpec.EXACTLY),
        )
        view.layout(0, 0, VIEW_SIZE_PX, VIEW_SIZE_PX)
        views.add(view)
      }
    }

    instrumentation.waitForIdleSync()
    SystemClock.sleep(ANIMATION_SETTLE_MILLIS)

    activityRule.scenario.onActivity { activity ->
      views.forEach { view ->
        activity.rootView.removeView(view)
        manager.onDropViewInstance(view)
      }
    }
    instrumentation.waitForIdleSync()
  }

  private fun collectGarbage(instrumentation: android.app.Instrumentation) {
    instrumentation.waitForIdleSync()
    Runtime.getRuntime().gc()
    System.runFinalization()
    instrumentation.waitForIdleSync()
  }

  private fun readJniGlobalRefCount(): Long? =
    runCatching { Debug.getRuntimeStat(JNI_GLOBAL_REF_STAT)?.toLongOrNull() }.getOrNull()

  private class ExposedHybridSkeletonManager : HybridSkeletonManager() {
    fun createForTest(reactContext: ThemedReactContext): View = createViewInstance(reactContext)
  }

  companion object {
    private const val TAG = "SkeletonChurnHarness"
    private const val JNI_GLOBAL_REF_STAT = "art.gc.jni-global-ref-count"
    private const val WARM_UP_ITERATIONS = 1_000
    private const val MEASURED_ITERATIONS = 30_000
    private const val BATCH_SIZE = 100
    private const val GLOBAL_REF_SAMPLE_BATCHES = 10
    private const val VIEW_SIZE_PX = 32
    private const val ANIMATION_SETTLE_MILLIS = 20L
    private const val MAX_GLOBAL_REF_DELTA = 512L
    private const val TEST_TIMEOUT_MILLIS = 10 * 60 * 1_000L
  }
}
