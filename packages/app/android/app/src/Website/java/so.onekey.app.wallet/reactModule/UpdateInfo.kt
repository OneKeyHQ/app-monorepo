package so.onekey.app.wallet.reactModule
import androidx.annotation.Keep

import com.google.gson.annotations.SerializedName

@Keep
data class UpdateInfo(
    @SerializedName("android")
    val android: Android,
    @SerializedName("ios")
    val ios: Ios
)

@Keep
data class Android(
    @SerializedName("googleplay")
    val googleplay: Googleplay,
    @SerializedName("website")
    val website: Website
)

@Keep
data class Ios(
    @SerializedName("appstore")
    val appstore: Appstore
)

@Keep
data class Googleplay(
    @SerializedName("forceVersionCode")
    val forceVersionCode: String,
    @SerializedName("versionCode")
    val versionCode: String,
    @SerializedName("versionName")
    val versionName: String
)

@Keep
data class Website(
    @SerializedName("forceVersionCode")
    val forceVersionCode: String?,
    @SerializedName("size")
    val size: String,
    @SerializedName("url")
    val url: String,
    @SerializedName("versionCode")
    val versionCode: String,
    @SerializedName("versionName")
    val versionName: String
)

@Keep
data class Appstore(
    @SerializedName("forceVersionCode")
    val forceVersionCode: String,
    @SerializedName("versionCode")
    val versionCode: String,
    @SerializedName("versionName")
    val versionName: String
)