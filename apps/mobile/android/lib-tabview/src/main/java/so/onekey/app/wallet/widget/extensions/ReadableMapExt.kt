package so.onekey.app.wallet.widget.extensions

import com.facebook.react.bridge.ReadableMap

fun ReadableMap.getIntOrNull(key: String): Int? {
    return if (hasKey(key)) getInt(key) else null
}

fun ReadableMap.getStringOrNull(key: String): String? {
    return if (hasKey(key)) getString(key) else null
}

fun ReadableMap.getBooleanOrNull(key: String): Boolean? {
    return if (hasKey(key)) getBoolean(key) else null
}