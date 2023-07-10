package so.onekey.app.wallet.onekeyLite.entitys

data class APDUParam(
    val cla: Long,
    val ins: Long,
    val p1: Long,
    val p2: Long,
    val data: String = ""
) {
    constructor(command: LongArray, data: String) : this(
        command[0],
        command[1],
        command[2],
        command[3],
        data
    )
}