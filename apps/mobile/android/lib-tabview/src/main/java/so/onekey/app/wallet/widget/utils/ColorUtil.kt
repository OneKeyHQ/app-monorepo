package so.onekey.app.wallet.widget.utils

import android.graphics.Color

fun parseColor(colorStr: String?): Int {
    if (colorStr !== null && colorStr.startsWith("#")) {
        return when (colorStr.length) {
            7 -> Color.parseColor(colorStr)
            9 -> {
                val argb = "#" + colorStr.substring(7) + colorStr.substring(1, 7)
                Color.parseColor(argb)
            }

            else -> throw IllegalArgumentException("Invalid color format")
        }
    }
    return 0
}