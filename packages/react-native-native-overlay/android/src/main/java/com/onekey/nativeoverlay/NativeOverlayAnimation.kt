package com.onekey.nativeoverlay

import android.animation.TimeInterpolator
import android.view.animation.PathInterpolator
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.sin
import kotlin.math.sqrt

/** Mirrors `IOverlayMotion` from `src/animation/types.ts`. */
internal sealed class OverlayMotion {
  data class Spring(val mass: Double, val stiffness: Double, val damping: Double) : OverlayMotion()

  data class Timing(
    val durationMs: Long,
    val x1: Float,
    val y1: Float,
    val x2: Float,
    val y2: Float,
  ) : OverlayMotion()

  fun interpolator(): TimeInterpolator = when (this) {
    is Spring -> SpringInterpolator(this)
    is Timing -> PathInterpolator(x1, y1, x2, y2)
  }

  fun durationMs(): Long = when (this) {
    is Spring -> SpringInterpolator.settleTimeMs(this)
    is Timing -> durationMs
  }

  companion object {
    /** Tamagui `quick` on native. */
    val QUICK = Spring(0.1, 100.0, 20.0)

    fun parse(json: JSONObject?): OverlayMotion {
      json ?: return QUICK
      return when (json.optString("type")) {
        "timing" -> {
          val timing = json.optJSONObject("timing") ?: return QUICK
          val easing = timing.optJSONArray("easing")
          val points = if (easing != null && easing.length() == 4) {
            FloatArray(4) { easing.optDouble(it).toFloat() }
          } else {
            floatArrayOf(0.25f, 0.1f, 0.25f, 1f)
          }
          Timing(
            timing.optDouble("durationMs", 150.0).toLong(),
            points[0],
            points[1],
            points[2],
            points[3],
          )
        }
        "spring" -> {
          val spring = json.optJSONObject("spring") ?: return QUICK
          Spring(
            spring.optDouble("mass", 1.0),
            spring.optDouble("stiffness", 100.0),
            spring.optDouble("damping", 20.0),
          )
        }
        else -> QUICK
      }
    }
  }
}

/**
 * Analytic step response of `m·x'' + c·x' + k·x = 0`, identical to
 * Reanimated and `springProgressAt` in JS. Driving one ValueAnimator with it
 * keeps alpha, translation, scale and backdrop on the same clock; androidx
 * SpringAnimation would need one animation per property.
 */
internal class SpringInterpolator(private val spring: OverlayMotion.Spring) : TimeInterpolator {
  private val durationMs = settleTimeMs(spring)

  override fun getInterpolation(input: Float): Float {
    if (input >= 1f) return 1f
    return progressAt(spring, input * durationMs / 1000.0).toFloat()
  }

  companion object {
    private const val EPSILON = 0.001
    private const val MAX_SETTLE_MS = 10_000L
    private val settleCache = HashMap<OverlayMotion.Spring, Long>()

    fun progressAt(spring: OverlayMotion.Spring, t: Double): Double {
      val w0 = sqrt(spring.stiffness / spring.mass)
      val zeta = spring.damping / (2 * sqrt(spring.stiffness * spring.mass))
      return when {
        zeta < 1 -> {
          val wd = w0 * sqrt(1 - zeta * zeta)
          1 - exp(-zeta * w0 * t) * (cos(wd * t) + (zeta * w0 / wd) * sin(wd * t))
        }
        zeta == 1.0 -> 1 - exp(-w0 * t) * (1 + w0 * t)
        else -> {
          val root = sqrt(zeta * zeta - 1)
          val r1 = -w0 * (zeta - root)
          val r2 = -w0 * (zeta + root)
          1 - (r2 * exp(r1 * t) - r1 * exp(r2 * t)) / (r2 - r1)
        }
      }
    }

    fun settleTimeMs(spring: OverlayMotion.Spring): Long = synchronized(settleCache) {
      settleCache.getOrPut(spring) {
        var lastOutside = 0L
        for (t in 0..MAX_SETTLE_MS) {
          if (abs(1 - progressAt(spring, t / 1000.0)) >= EPSILON) lastOutside = t
        }
        lastOutside + 1
      }
    }
  }
}

/** Mirrors `IResolvedOverlayTransition`. */
internal data class OverlayTransition(
  val kind: String = "fade",
  val edge: String = "bottom",
  val distanceDp: Double? = null,
  val scale: Float = 0.95f,
  val offsetYDp: Double = 0.0,
  val fade: Boolean = true,
  val motion: OverlayMotion = OverlayMotion.QUICK,
) {
  val hidesOpacity: Boolean get() = kind == "fade" || fade

  fun reduceMotionAdjusted(reduceMotion: Boolean): OverlayTransition =
    if (reduceMotion && kind != "none") copy(kind = "fade", fade = true) else this

  companion object {
    fun parse(json: JSONObject?): OverlayTransition {
      json ?: return OverlayTransition()
      val kind = json.optString("type", "fade")
      return OverlayTransition(
        kind = kind,
        edge = json.optString("edge", "bottom"),
        distanceDp = if (json.has("distance")) json.optDouble("distance") else null,
        scale = json.optDouble("scale", 0.95).toFloat(),
        offsetYDp = json.optDouble("offsetY", 0.0),
        fade = if (json.has("fade")) json.optBoolean("fade") else kind == "fade" || kind == "scale",
        motion = OverlayMotion.parse(json.optJSONObject("motion")),
      )
    }
  }
}

/** Mirrors `IResolvedOverlayAnimation`. */
internal data class OverlayAnimationConfig(
  val enter: OverlayTransition = OverlayTransition(),
  val exit: OverlayTransition = OverlayTransition(),
  val backdropMotion: OverlayMotion = OverlayMotion.QUICK,
) {
  companion object {
    fun parse(source: String?): OverlayAnimationConfig {
      if (source.isNullOrEmpty()) return OverlayAnimationConfig()
      return try {
        val json = JSONObject(source)
        val enter = OverlayTransition.parse(json.optJSONObject("enter"))
        OverlayAnimationConfig(
          enter = enter,
          exit = json.optJSONObject("exit")?.let(OverlayTransition::parse) ?: enter,
          backdropMotion = OverlayMotion.parse(
            json.optJSONObject("backdrop")?.optJSONObject("motion"),
          ),
        )
      } catch (_: Exception) {
        OverlayAnimationConfig()
      }
    }
  }
}
