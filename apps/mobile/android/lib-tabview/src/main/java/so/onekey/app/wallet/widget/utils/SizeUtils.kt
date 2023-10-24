package so.onekey.app.wallet.widget.utils

import android.content.Context

object SizeUtils {
    fun dp2px(context: Context, dpValue: Float?): Int {
        if (dpValue == null) return 0
        val scale = context.resources.displayMetrics.density
        return (dpValue * scale + 0.5f).toInt()
    }

    fun sp2px(context: Context, sp: Float?): Int {
        if (sp == null) return 0
        val scale = context.resources.displayMetrics.scaledDensity
        return (sp * scale + 0.5f).toInt()
    }
}