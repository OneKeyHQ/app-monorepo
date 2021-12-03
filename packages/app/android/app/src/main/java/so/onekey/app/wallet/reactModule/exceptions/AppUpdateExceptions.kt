package so.onekey.app.wallet.reactModule.exceptions

sealed class AppUpdateExceptions(val code: Int, override val message: String? = null) : Exception(message) {
    companion object {
        const val REJECT_CODE = "reject"
    }

    fun toJson(): String {
        return """{"code":$code,"message":"$message"}"""
    }

    // 没有更新
    class NoUpdateAvailable(message: String? = null) : AppUpdateExceptions(1000, message)

    // 正在更新
    class UpdatingApp(message: String? = null) : AppUpdateExceptions(1001, message)

    // 下载失败
    class DownloadFailed(message: String? = null) : AppUpdateExceptions(2001, message)

    // 获取更新失败
    class ObtainUpdatesFailed(message: String? = null) : AppUpdateExceptions(2002, message)

    // 还没下载完成
    class DownloadNotComplete(message: String? = null) : AppUpdateExceptions(2004, message)

    // 无法取消的下载更新
    class IrrevocableUpdate(message: String? = null) : AppUpdateExceptions(2005, message)
}
