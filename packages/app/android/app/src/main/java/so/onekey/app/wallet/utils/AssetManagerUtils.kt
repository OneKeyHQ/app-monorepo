package so.onekey.app.wallet.utils

import android.content.Context
import java.io.*
import java.nio.charset.StandardCharsets

object AssetManagerUtils {
    fun readTextFile(context: Context, fileName: String): String {
        return try {
            BufferedReader(InputStreamReader(context.assets.open(fileName), StandardCharsets.UTF_8)).useLines { lines ->
                val results = StringBuilder()
                lines.forEach { results.append(it) }
                results.toString()
            }
        } catch (e: IOException) {
            e.printStackTrace()
            ""
        }
    }
}