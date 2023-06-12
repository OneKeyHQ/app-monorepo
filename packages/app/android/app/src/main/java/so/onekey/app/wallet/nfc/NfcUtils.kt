package so.onekey.app.wallet.nfc

import android.app.Activity
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.tech.*
import android.os.Build
import android.provider.Settings
import so.onekey.app.wallet.utils.MiUtil

object NfcUtils {

    @JvmField
    var mNfcAdapter: NfcAdapter? = null

    @JvmField
    var mIntentFilter: Array<IntentFilter>? = null

    @JvmField
    var mPendingIntent: PendingIntent? = null

    @JvmField
    var mTechList: Array<Array<String>>? = null

    private fun getPendingIntent(activity: Activity): PendingIntent? {
        val intent = Intent(activity, activity.javaClass)
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        var flag = 0
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flag = PendingIntent.FLAG_MUTABLE
        } else {
            flag = PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getActivity(activity, 0, intent, flag)
    }

    private fun getIntentFilters(): Array<IntentFilter> {
        return arrayOf(
            IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED, "*/*"),
        )
    }

    private fun getTechLists(): Array<Array<String>> {
        return arrayOf(
            arrayOf(NfcA::class.java.name),
            arrayOf(IsoDep::class.java.name)
        )
    }

    @JvmStatic
    fun init(activity: Activity): NfcAdapter? {
        mNfcAdapter = NfcAdapter.getDefaultAdapter(activity)
        mTechList = getTechLists()
        mPendingIntent = getPendingIntent(activity)
        mIntentFilter = getIntentFilters()
        return mNfcAdapter
    }

    /**
     * 判断手机是否具备NFC功能.
     *
     * @param context [Context]
     * @return `true`: 具备 `false`: 不具备
     */
    fun isNfcExits(context: Context): Boolean {
        val nfcAdapter = NfcAdapter.getDefaultAdapter(context)
        return nfcAdapter != null
    }

    /**
     * 判断手机NFC是否开启.
     *
     * OPPO A37m 发现必须同时开启NFC以及Android Beam才可以使用
     * 20180108 发现OPPO单独打开NFC即可读取标签，不清楚是否是系统更新
     *
     * @param context [Context]
     * @return `true`: 已开启 `false`: 未开启
     */
    fun isNfcEnable(context: Context): Boolean {
        val nfcAdapter = NfcAdapter.getDefaultAdapter(context)
        return nfcAdapter != null && nfcAdapter.isEnabled
    }

    /**
     * 判断手机是否具备Android Beam.
     *
     * @param context [Context]
     * @return `true`:具备 `false`:不具备
     */
    fun isAndroidBeamExits(context: Context): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && isNfcExits(context)
    }

    /**
     * 跳转至系统NFC设置界面.
     *
     * @param context [Context]
     * @return `true` 跳转成功 <br></br> `false` 跳转失败
     */
    fun intentToNfcSetting(context: Context): Boolean {
        if ("Smartisan".equals(Build.MANUFACTURER, true)) {
            if (intentToNfcShare(context)) {
                return true
            }
        }
        if ("xiaomi".equals(Build.MANUFACTURER, true)) {
            MiUtil.intentToAppSetting(context)
            return true
        }
        if (isNfcExits(context)) {
            return toIntent(context, Settings.ACTION_NFC_SETTINGS)
        }
        return false

    }

    /**
     * 跳转至系统NFC Android Beam设置界面，同页面基本都有NFC开关.
     *
     * @param context [Context]
     * @return `true` 跳转成功 <br></br> `false` 跳转失败
     */
    fun intentToNfcShare(context: Context): Boolean {
        return if (isAndroidBeamExits(context)) {
            toIntent(context, Settings.ACTION_NFCSHARING_SETTINGS)
        } else false
    }

    /**
     * 跳转方法.
     *
     * @param context [Context]
     * @param action  意图
     * @return 是否跳转成功 `true ` 成功<br></br>`false`失败
     */
    private fun toIntent(context: Context, action: String): Boolean {
        try {
            val intent = Intent(action)
            context.startActivity(intent)
        } catch (ex: Exception) {
            ex.printStackTrace()
            return false
        }

        return true
    }

}
