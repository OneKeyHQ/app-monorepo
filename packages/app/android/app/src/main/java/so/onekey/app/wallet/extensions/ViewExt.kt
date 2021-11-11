package so.onekey.app.wallet.extensions

import androidx.annotation.ColorInt
import androidx.core.content.ContextCompat
import so.onekey.app.wallet.utils.Utils

private fun getApp() = Utils.getApp()
private fun getTopActivity() = Utils.getTopActivity()

fun Int.string(): String {
    // 国际化方案问题，MyApplication Context 没有改变 Locale。
    return getTopActivity()?.getString(this) ?: getApp().getString(this)
}

@ColorInt
fun String.color(): Int? {
    return try {
        (getTopActivity()?.resources ?: getApp().resources)
                .getIdentifier(
                        this, "color", getApp().packageName
                ).color()
    } catch (e: Exception) {
        null
    }
}

@ColorInt
fun Int.color(): Int {
    return ContextCompat.getColor(getApp(), this)
}
