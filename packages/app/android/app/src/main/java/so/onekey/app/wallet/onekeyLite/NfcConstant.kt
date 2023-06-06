package so.onekey.app.wallet.onekeyLite

import android.nfc.tech.IsoDep
import so.onekey.app.wallet.utils.HexUtils
import java.io.IOException


/**
 * @Author:         peter Qin
 */
object NfcConstant {
    const val DEBUG = false
    const val MNEMONIC = "mnemonics"
    const val MODE = "statusMode"
    const val SELECT_CARD_ID = "select_card_id"
    const val VERIFY_SUCCESS = 100
    const val INTERRUPT_STATUS = 1000
    const val RESET_INTERRUPT_STATUS = 1001
    const val GET_RETRY_NUM_INTERRUPT_STATUS = 1002
    const val RESET_PIN_SUCCESS = -1
    const val CHANGE_PIN_SUCCESS = -10
    const val CHANGE_PIN_ERROR = -100
    const val NEW_PIN = "029000"
    const val MAX_RETRY_NUM = 10
    const val NO_RETRY_NUM_RESET_CARD = 0
    const val NOT_MATCH_DEVICE = "cannot_match_device"
    const val INIT_CHANNEL_SUCCESS = 104
    const val INIT_CHANNEL_FAILURE = 105
    const val STATUS_SUCCESS = "9000"
    const val STATUS_FAILURE = "FFFF"
    const val HAS_BACK_UP = "029000"

    const val LITE_VERSION = "01"
    const val LITE_LANGUAGE = "00"// english
    const val LITE_TAG = "ffff"

    private const val RESPONSE_STATUS_LENGTH = 4
}
