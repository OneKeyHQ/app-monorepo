package so.onekey.app.wallet.onekeyLite.nfc

import com.google.gson.Gson
import org.haobtc.onekey.card.gpchannel.GPChannelNatives
import so.onekey.app.wallet.onekeyLite.entitys.APDUParam
import so.onekey.app.wallet.utils.LogUtil.printLog

object GPCAPDUGenerator {
    private const val TAG = "GPCAPDUGenerator"

    @JvmStatic
    fun buildGPCAPDU(param: APDUParam, safeChannel: Boolean = false): String {
        printLog(TAG, "  --->> BuildGPCAPDU begin")
        return if (safeChannel) {
            GPChannelNatives.nativeGPCBuildSafeAPDU(
                param.cla,
                param.ins,
                param.p1,
                param.p2,
                param.data
            )
        } else {
            GPChannelNatives.nativeGPCBuildAPDU(
                param.cla,
                param.ins,
                param.p1,
                param.p2,
                param.data
            )
        }.also {
            printLog(TAG, "  <<--- BuildGPCAPDU done: safeChannel:$safeChannel")
        }
    }

    @JvmStatic
    fun combCommand(command: ByteArray? = null, vararg params: ByteArray?): ByteArray {
        var combParam = byteArrayOf()
        params.forEach { param ->
            param?.let {
                combParam = combParam.plus(it.size.toByte())
                combParam = combParam.plus(it)
            }
        }

        var combCommand = byteArrayOf()
        command?.let {
            combCommand = combCommand.plus(it)
            if (params.size != 1) {
                // params 只有一个的时候就不再次拼接长度了
                combCommand = combCommand.plus(combParam.size.toByte())
            }
        }
        combCommand = combCommand.plus(combParam)
        return combCommand
    }
}