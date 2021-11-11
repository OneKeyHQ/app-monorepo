package so.onekey.app.wallet.nfc

import android.app.Activity
import android.app.AppOpsManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.tech.IsoDep
import android.nfc.tech.Ndef
import android.nfc.tech.NfcF
import android.nfc.tech.NfcV
import android.os.Process
import android.provider.Settings
import androidx.annotation.StringRes
import so.onekey.app.wallet.R
import so.onekey.app.wallet.dialog.BaseAlertBottomDialog
import so.onekey.app.wallet.dialog.BaseAlertCenterDialog
import so.onekey.app.wallet.extensions.string

object NfcUtils {

    @JvmField
    var mNfcAdapter: NfcAdapter? = null

    @JvmField
    var mIntentFilter: Array<IntentFilter>? = null

    @JvmField
    var mPendingIntent: PendingIntent? = null

    @JvmField
    var mTechList: Array<Array<String>>? = null

    @JvmStatic
    fun init(activity: Activity): NfcAdapter? {
        mNfcAdapter = NfcAdapter.getDefaultAdapter(activity)
        mTechList = arrayOf(arrayOf(Ndef::class.java.name), arrayOf(NfcV::class.java.name), arrayOf(NfcF::class.java.name), arrayOf(IsoDep::class.java.name))
        // PendingIntent，the intent processing the coming tag
        mPendingIntent = PendingIntent.getActivity(
                activity,
                0,
                Intent(activity, activity.javaClass)
                        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT)
        mIntentFilter = arrayOf(IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED, "*/*"))
        return mNfcAdapter
    }

    fun checkPermission(activity: Activity): Boolean {
        if (mNfcAdapter == null) {
            showBottomDialog(activity, R.string.modal__unable_to_recover_data_from_the_device, R.string.modal__unable_to_recover_data_from_the_device_desc)
            return false
        }
        if (mNfcAdapter?.isEnabled != true) {
            isToSet(activity)
            return false
        }
        // 先保障大部分设备不会明明有权限也不可用，后面在做更细致的检测
        // if (!hasOpPermission(activity, 10016)) {
        //   isToSet(activity)
        //   return false
        // }
        return true
    }

    private fun isToSet(activity: Activity) {
        BaseAlertCenterDialog.Builder(activity)
                .modifyTitle(
                        R.string.modal__turn_on_nfc_and_let_onekey_connect_your_hardware_devices.string())
                .setContent(
                        R.string.modal__turn_on_nfc_and_let_onekey_connect_your_hardware_devices_desc.string())
                .setPositiveClick { goToSet(activity) }
                .setNegativeClick { activity.finish() }
                .build()
                .show()
    }

    private fun showBottomDialog(activity: Activity, @StringRes titleResId: Int, @StringRes messageResId: Int) {
        BaseAlertBottomDialog.build(activity) {
            setIcon(R.drawable.vector_warning_yellow)
                    .setTitle(titleResId)
                    .setMessage(messageResId)
                    .setPrimaryButtonText(R.string.action__ok_i_got_it)
                    .setPrimaryButtonListener {
                        it.dismiss()
                        activity.finish()
                    }.build().showDialog()
        }
    }

    private fun goToSet(activity: Activity) {
        // 进入设置系统应用权限界面
        val intent = Intent(Settings.ACTION_SETTINGS)
        activity.startActivity(intent)
    }

    /**
     * 检查类似小米那样独有的权限是否已经允许。
     * 比如：NFC、后台弹出界面等非官方权限。
     *
     * @param op 取值如下：
     * * op=10016 对应 NFC
     * * op=10021 对应 后台弹出界面
     * * 其它未知，根据博客的方法自己去找你需要的
     *
     * @return true为允许，false为询问或者拒绝。
     */
    private fun hasOpPermission(context: Context, op: Int): Boolean {
        return try {
            val manager = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val method = manager.javaClass.getMethod("checkOpNoThrow", Int::class.java, Int::class.java, String::class.java)
            val result = method.invoke(manager, op, Process.myUid(), context.packageName)
            AppOpsManager.MODE_ALLOWED == result
        } catch (e: Exception) {
            e.printStackTrace()
            true
        }
    }

}
