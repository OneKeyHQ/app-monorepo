package so.onekey.app.wallet.nfc

sealed class NFCExceptions(val code: Int, override val message: String? = null) : Exception(message) {
    fun toJson(): String {
        return """{"code":$code,"message":"$message"}"""
    }

    // 初始化异常
    class InitChannelException(message: String? = null) : NFCExceptions(1000, message)

    // 没有 NFC 设备
    class NotExistsNFC(message: String? = null) : NFCExceptions(1001, message)

    // 没有开启 NFC 设备
    class NotEnableNFC(message: String? = null) : NFCExceptions(1002, message)

    // 没有使用 NFC 的权限
    class NotNFCPermission(message: String? = null) : NFCExceptions(1003, message)

    // 连接失败
    class ConnectionFailException(message: String? = null) : NFCExceptions(2001, message)

    // 操作中断（可能是连接问题）
    class InterruptException(message: String? = null) : NFCExceptions(2002, message)

    // 连接设备不匹配
    class DeviceMismatchException(message: String? = null) : NFCExceptions(2003, message)

    // 密码错误
    class PasswordWrongException(message: String? = null) : NFCExceptions(3001, message)

    // 输入密码为空
    class InputPasswordEmptyException(message: String? = null) : NFCExceptions(3002, message)

    // 未设置过密码
    class PasswordEmptyException(message: String? = null) : NFCExceptions(3003, message)

    // 设置初始化密码错误
    class InitPasswordException(message: String? = null) : NFCExceptions(3004, message)

    // 未知的命令执行失败
    class ExecFailureException(message: String? = null) : NFCExceptions(4000, message)

    // 已经备份过内容
    class InitializedException(message: String? = null) : NFCExceptions(4001, message)

    // 没有备份过内容
    class NotInitializedException(message: String? = null) : NFCExceptions(4002, message)
}
