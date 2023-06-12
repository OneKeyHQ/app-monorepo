package so.onekey.app.wallet.onekeyLite.nfc

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.haobtc.onekey.card.gpchannel.GPChannelNatives.nativeGPCParseAPDUResponse
import org.haobtc.onekey.card.gpchannel.GPChannelNatives.nativeGPCParseSafeAPDUResponse
import so.onekey.app.wallet.nfc.NFCExceptions
import so.onekey.app.wallet.onekeyLite.entitys.APDUParam
import so.onekey.app.wallet.onekeyLite.entitys.CardResponse
import so.onekey.app.wallet.onekeyLite.entitys.SendResponse
import so.onekey.app.wallet.utils.Utils

enum class AppleCardType(val aid: String, val prefixSN: String) {
    V1("D156000132834001", "OKLFT"),
    V2("6f6e656b65792e6261636b757001", "OKLFB"),
}

enum class CommandArea(val code: String) {
    None("none"), BackupApplet("backup"), PrimarySafety("master");

    companion object {
        fun parse(code: String): CommandArea {
            return when (code) {
                "backup" -> BackupApplet
                "master" -> PrimarySafety
                else -> None
            }
        }
    }
}

enum class CommandType(val code: String) {
    SELECT_BACKUP_APPLET("select_backup_applet"),
    SELECT_PRIMARY_SAFETY("select_primary_safety"),
    GET_BACKUP_STATUS("get_backup_status"),
    GET_PIN_STATUS("get_pin_status"),
    GET_SERIAL_NUMBER("get_serial_number"),
    GET_PIN_RETRY_COUNT("get_pin_retry_count"),
    RESET_CARD("reset_card"),
    VERIFY_PIN("verify_pin"),
    SETUP_NEW_PIN("setup_new_pin"),
    CHANGE_PIN("change_pin"),
    BACKUP_DATA("backup_data"),
    EXPORT_DATA("export_data"),
    VERIFY_CERTIFICATE("verify_certificate"),
    VERIFY_AUTH_DATA("verify_auth_data"),
}

class Command(
    private val cardType: AppleCardType,
    val area: CommandArea,
    val command: String,
    private val ignoreSafeChannel: Boolean,
    private val useSafeChannel: Boolean,
    private val useSafeChannelWhenOpen: Boolean,
    private val hasOpenSafeChannel: Boolean,
    val data: String,
) {
    private fun beforeConnecting(connection: Connection) {
        val needOpenSafeChannel = useSafeChannel || (useSafeChannelWhenOpen && hasOpenSafeChannel)
        val needCloseSafeChannel =
            (!useSafeChannel && !(useSafeChannelWhenOpen && hasOpenSafeChannel))

        if (!ignoreSafeChannel && needCloseSafeChannel) {
            if (hasOpenSafeChannel) connection.resetSecureChannel()
        }

        if (area == CommandArea.BackupApplet) {
            if (connection.getCurrentCommandArea() != CommandArea.BackupApplet) {
                connection.selectBackupApplet(cardType)
            }
        } else if (area == CommandArea.PrimarySafety) {
            if (connection.getCurrentCommandArea() != CommandArea.PrimarySafety) {
                connection.selectPrimarySafety()
            }
        }

        if (!ignoreSafeChannel && needOpenSafeChannel) {
            val res = connection.openSafeChannel()
            if (!res) throw NFCExceptions.InterruptException()
        }
    }

    private fun splitHex(hex: String): List<String> {
        val result = mutableListOf<String>()
        for (i in hex.indices step 2) {
            result.add(hex.substring(i, i + 2))
        }
        return result
    }

    private fun buildApdu(): String {
        val commandByteArray = splitHex(command).map { it.toLong(16) }.toLongArray()
        return GPCAPDUGenerator.buildGPCAPDU(
            APDUParam(commandByteArray, data),
            useSafeChannel || (useSafeChannelWhenOpen && hasOpenSafeChannel)
        )
    }

    private fun parseResponse(response: String): String {
        return if (useSafeChannel || (useSafeChannelWhenOpen && hasOpenSafeChannel)) {
            nativeGPCParseSafeAPDUResponse(response)
        } else {
            nativeGPCParseAPDUResponse(response)
        }
    }

    fun send(connection: Connection): SendResponse {
        beforeConnecting(connection)
        // buildApdu && parseResponse Use in pairs
        val apdu = buildApdu()
        val result = Connection.send(connection.isoDep, apdu)
        val resultObject = CardResponse.objectFromData(parseResponse(result.rawResponse))
        result.result = resultObject?.response ?: ""
        return result
    }
}

class CommandGenerator {
    companion object {
        private fun readConfig(): JsonObject {
            val context = Utils.getApp()
            val config = context.assets.open("config/command.json")
            config.use {
                val json = it.bufferedReader().use { it.readText() }
                return JsonParser.parseString(json).asJsonObject
            }
        }

        val instanceConfig by lazy(LazyThreadSafetyMode.NONE) {
            readConfig()
        }
    }

    fun generalCommand(
        cardType: AppleCardType,
        type: CommandType,
        hasOpenSafeChannel: Boolean,
        data: String? = null
    ): Command {

        val config = when (cardType) {
            AppleCardType.V1 -> instanceConfig.getAsJsonObject(type.code).getAsJsonObject("v1")
            AppleCardType.V2 -> instanceConfig.getAsJsonObject(type.code).getAsJsonObject("v2")
        }

        val area = if (config.has("area")) {
            CommandArea.parse(config["area"].asString)
        } else {
            CommandArea.None
        }
        val ignoreSafeChannel =
            config.has("ignoreSafeChannel") && config["ignoreSafeChannel"].asBoolean
        val useSafeChannel = config.has("useSafeChannel") && config["useSafeChannel"].asBoolean
        val useSafeChannelWhenOpen =
            config.has("useSafeChannelWhenOpen") && config["useSafeChannelWhenOpen"].asBoolean
        val needData = config.has("needData") && config["needData"].asBoolean
        val command = if (config.has("command")) {
            config["command"].asString
        } else {
            throw Exception("command not found")
        }

        if (needData && data == null) throw Exception("data is null")

        return Command(
            cardType = cardType,
            area = area,
            command = command,
            ignoreSafeChannel = ignoreSafeChannel,
            useSafeChannel = useSafeChannel,
            useSafeChannelWhenOpen = useSafeChannelWhenOpen,
            hasOpenSafeChannel = hasOpenSafeChannel,
            data = data ?: ""
        )
    }

}
