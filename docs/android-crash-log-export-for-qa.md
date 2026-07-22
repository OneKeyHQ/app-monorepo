# OneKey Android 崩溃日志导出指南（QA / AI 执行版）

本文用于从发生崩溃的 Android 设备导出系统退出原因、Logcat 和完整 Bugreport。QA 可以把本文直接交给本机 AI，让 AI 在终端中协助执行。

## 本次排查信息

- 应用包名：`so.onekey.app.wallet`
- 重点崩溃时间：约 `14:47`（请同时记录发生日期和时区）
- 建议设备：发生崩溃的原始设备
- 建议尽快导出：Android 日志和历史退出记录均可能被后续运行覆盖

## 先发给 AI 的提示词

将下面这段话连同本文一起发给 AI：

> 请按照本文从当前连接的 Android 设备导出 OneKey 崩溃日志。先检查 ADB 和设备连接，只执行只读采集命令；不要清空日志、不要重启设备、不要卸载或重装应用、不要 Root。若连接了多台设备，先让我选择。执行结束后请确认各文件是否生成，打包成一个 ZIP，并告诉我 ZIP 的完整路径和任何失败项。应用包名是 so.onekey.app.wallet，重点检查 14:47 前后的进程退出、低内存、SIGKILL、Java/Native Crash 和 ANR。

## 导出前注意事项

1. 尽量不要重启手机，也不要卸载、重装或清除 OneKey 数据。
2. 尽量减少继续操作手机或反复启动 OneKey，避免旧记录被覆盖。
3. 手机开启“开发者选项”和“USB 调试”，通过 USB 连接电脑。
4. 手机上出现“允许 USB 调试”提示时选择允许。
5. 电脑需要安装 Android SDK Platform Tools（其中包含 `adb`）。
6. Bugreport 可能包含设备、账户、应用列表和系统状态等敏感信息，只能通过公司批准的内部渠道传输。

## AI 执行要求

AI 应按以下规则操作：

- 首先识别电脑操作系统，并使用对应的 Shell 命令。
- 所有采集均为只读操作。
- 禁止执行 `adb logcat -c`、恢复出厂设置、卸载应用、清除应用数据、重启设备或 Root。
- 若 `adb devices -l` 显示多台设备，不得自行选择，必须先询问 QA。
- 若设备状态是 `unauthorized`，提示 QA 解锁手机并接受 USB 调试授权。
- 若设备状态是 `offline`，提示 QA 重新插拔 USB，并再次检查连接。
- 某一项采集失败时继续采集其余项目，并在最终结果中明确记录失败原因。

## 第一步：检查 ADB 和设备

macOS / Linux：

```bash
command -v adb
adb version
adb devices -l
```

Windows PowerShell：

```powershell
Get-Command adb
adb version
adb devices -l
```

正常情况下只能看到一台状态为 `device` 的设备，例如：

```text
XXXXXXXXXXXX    device product:... model:... device:...
```

如果找不到 `adb`，请让 AI 查找 Android SDK 的 `platform-tools` 目录，或安装官方 [SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools)。

## 第二步：确认应用和设备信息

macOS / Linux：

```bash
adb shell pm path so.onekey.app.wallet
adb shell getprop ro.product.manufacturer
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell dumpsys package so.onekey.app.wallet | grep -E "versionName|versionCode"
```

Windows PowerShell：

```powershell
adb shell pm path so.onekey.app.wallet
adb shell getprop ro.product.manufacturer
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell dumpsys package so.onekey.app.wallet | Select-String "versionName|versionCode"
```

如果 `pm path` 没有输出，让 AI 执行下面的命令查找实际包名，并将后续命令中的包名替换为正确值：

```bash
adb shell pm list packages | grep -i onekey
```

Windows PowerShell 使用：

```powershell
adb shell pm list packages | Select-String -Pattern "onekey" -CaseSensitive:$false
```

## 第三步：一键导出（macOS / Linux）

在希望保存日志的目录打开终端，执行：

```bash
EXPORT_DIR="onekey-android-crash-$(date +%Y%m%d-%H%M%S)"
PACKAGE_NAME="so.onekey.app.wallet"

mkdir -p "$EXPORT_DIR"

adb devices -l > "$EXPORT_DIR/00-adb-devices.txt"
adb shell getprop > "$EXPORT_DIR/01-device-getprop.txt"
adb shell dumpsys package "$PACKAGE_NAME" > "$EXPORT_DIR/02-package-info.txt"
adb shell dumpsys activity exit-info "$PACKAGE_NAME" > "$EXPORT_DIR/03-application-exit-info.txt"
adb logcat -b main -b system -b crash -b events -d -v threadtime > "$EXPORT_DIR/04-logcat.txt"
adb shell dumpsys dropbox --print data_app_crash > "$EXPORT_DIR/05-dropbox-data-app-crash.txt"
adb shell dumpsys dropbox --print data_app_anr > "$EXPORT_DIR/06-dropbox-data-app-anr.txt"
adb shell dumpsys meminfo "$PACKAGE_NAME" > "$EXPORT_DIR/07-meminfo.txt"
adb shell dumpsys activity processes > "$EXPORT_DIR/08-activity-processes.txt"
adb bugreport "$EXPORT_DIR"

zip -r "$EXPORT_DIR.zip" "$EXPORT_DIR"

echo "导出目录: $(pwd)/$EXPORT_DIR"
echo "压缩文件: $(pwd)/$EXPORT_DIR.zip"
```

说明：

- `03-application-exit-info.txt` 是最关键的文件，用于判断进程是低内存、崩溃、Native Crash、ANR 还是被信号终止。
- `04-logcat.txt` 包含当前仍保留在系统缓冲区中的应用和系统日志。
- `05`、`06` 文件尝试读取 Android DropBox 中的 Crash/ANR 记录；部分设备可能没有记录。
- `adb bugreport` 通常需要几分钟，期间不要断开 USB。生成的 Bugreport ZIP 一般位于导出目录内。
- 如果电脑没有 `zip` 命令，让 AI 使用系统自带的压缩方式打包整个导出目录。

## 第四步：一键导出（Windows PowerShell）

在希望保存日志的目录打开 PowerShell，执行：

```powershell
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ExportDir = "onekey-android-crash-$Timestamp"
$PackageName = "so.onekey.app.wallet"

New-Item -ItemType Directory -Path $ExportDir | Out-Null

adb devices -l | Out-File "$ExportDir/00-adb-devices.txt" -Encoding utf8
adb shell getprop | Out-File "$ExportDir/01-device-getprop.txt" -Encoding utf8
adb shell dumpsys package $PackageName | Out-File "$ExportDir/02-package-info.txt" -Encoding utf8
adb shell dumpsys activity exit-info $PackageName | Out-File "$ExportDir/03-application-exit-info.txt" -Encoding utf8
adb logcat -b main -b system -b crash -b events -d -v threadtime | Out-File "$ExportDir/04-logcat.txt" -Encoding utf8
adb shell dumpsys dropbox --print data_app_crash | Out-File "$ExportDir/05-dropbox-data-app-crash.txt" -Encoding utf8
adb shell dumpsys dropbox --print data_app_anr | Out-File "$ExportDir/06-dropbox-data-app-anr.txt" -Encoding utf8
adb shell dumpsys meminfo $PackageName | Out-File "$ExportDir/07-meminfo.txt" -Encoding utf8
adb shell dumpsys activity processes | Out-File "$ExportDir/08-activity-processes.txt" -Encoding utf8
adb bugreport $ExportDir

Compress-Archive -Path $ExportDir -DestinationPath "$ExportDir.zip" -Force

Write-Host "导出目录: $((Resolve-Path $ExportDir).Path)"
Write-Host "压缩文件: $((Resolve-Path "$ExportDir.zip").Path)"
```

## 无法连接电脑时：直接从手机生成 Bugreport

如果暂时无法使用 ADB，可以在发生问题的手机上操作：

1. 打开“开发者选项”。
2. 选择“提交错误报告”或“Take bug report”。
3. 选择“完整报告 / Full report”。
4. 等待系统生成 ZIP，并通过公司批准的内部渠道发送。

不同 Android 厂商的菜单名称可能略有不同。手机直接生成的 Bugreport 可以作为补充，但仍建议尽可能同时导出 `ApplicationExitInfo`。

## AI 应重点分析的内容

在 `03-application-exit-info.txt` 中寻找崩溃时间附近的记录，重点关注：

- `REASON_LOW_MEMORY`：系统因内存压力终止应用。
- `REASON_CRASH`：Java/Kotlin 或应用进程未捕获异常。
- `REASON_CRASH_NATIVE`：Native/NDK 崩溃。
- `REASON_ANR`：应用无响应。
- `REASON_SIGNALED`：进程被信号终止，结合 `status` 判断是否为 `SIGKILL`。
- `timestamp`：是否与 QA 记录的崩溃时间一致。
- `rss` / `pss`：退出前的内存占用。
- `importance`、`description`、`status`：系统给出的辅助原因。

注意：部分 Android 厂商可能把低内存终止记录成 `REASON_SIGNALED + SIGKILL`，不能只根据单一字段下结论。

在 Logcat、DropBox 和 Bugreport 中搜索：

```text
so.onekey.app.wallet
FATAL EXCEPTION
Fatal signal
SIGABRT
SIGSEGV
SIGKILL
lowmemorykiller
lmkd
OutOfMemoryError
ANR in
am_crash
am_anr
am_kill
tombstone
```

## 交付给研发的文件和信息

请发送最终生成的 ZIP，并同时提供：

- 崩溃发生日期、准确时间和时区。
- 复现步骤。
- 预期行为和实际行为。
- 手机品牌、型号和 Android 版本。
- OneKey 版本号、构建号和安装渠道。
- 崩溃后是否重启过设备。
- 崩溃后是否重新打开过 OneKey，以及大约打开过几次。
- AI 执行过程中失败的命令及其错误输出。

## 参考资料

- [ApplicationExitInfo](https://developer.android.com/reference/android/app/ApplicationExitInfo)
- [Android Bugreport](https://developer.android.com/studio/debug/bug-report)
- [Android 11 进程退出原因](https://developer.android.com/about/versions/11/features#process-exit-reasons)
