!ifndef ONEKEY_DIRECTORY_RECOVERY_NSH
!define ONEKEY_DIRECTORY_RECOVERY_NSH

!ifndef ONEKEY_RECOVERY_JOURNAL_KEY
  !define ONEKEY_RECOVERY_JOURNAL_KEY "Software\OneKey\InstallerDirectoryRecovery"
!endif
!ifndef ONEKEY_RECOVERY_MUTEX
  !define ONEKEY_RECOVERY_MUTEX "Global\OneKeyInstallerDirectoryRecovery"
!endif
!define ONEKEY_RECOVERY_TOKEN_CHARS 32
!define ONEKEY_RECOVERY_CARRIER "OneKeyInstallerInventory.dll"
!define ONEKEY_RECOVERY_UNINSTALL_COMPLETED 15
!define ONEKEY_RECOVERY_UNSUPPORTED_LOCATION 16
!define ONEKEY_RECOVERY_TARGET_NOT_EMPTY 17
!define ONEKEY_RECOVERY_WALLET_DATA_OVERLAP 18
!define ONEKEY_RECOVERY_HISTORICAL_LOCATION_UNSUPPORTED 19
!define ONEKEY_RECOVERY_MACHINE_LEGACY_OWNERSHIP_UNVERIFIED 20
Var OneKeyRecoveryInitiatingAppData

!macro OneKeyRecoveryReportPathError RESULT
  ${IfNot} ${Silent}
    ${If} ${RESULT} == "${ONEKEY_RECOVERY_UNSUPPORTED_LOCATION}"
      !insertmacro OneKeyInstallerMessage MB_OK|MB_ICONSTOP|MB_SETFOREGROUND \
        "OneKey could not verify an installation location. Connect the installation drives and use a local fixed drive and a folder without junctions or other redirects." \
        "OneKey 无法验证安装位置。请连接安装所用的磁盘，并使用本地固定磁盘上未被重定向的文件夹。"
    ${ElseIf} ${RESULT} == "${ONEKEY_RECOVERY_WALLET_DATA_OVERLAP}"
      !insertmacro OneKeyInstallerMessage MB_OK|MB_ICONSTOP|MB_SETFOREGROUND \
        "The installation folder overlaps OneKey wallet data. Choose an installation folder outside the wallet data folder." \
        "安装位置与 OneKey 钱包数据目录重叠。请选择钱包数据目录之外的安装位置。"
    ${ElseIf} ${RESULT} == "${ONEKEY_RECOVERY_HISTORICAL_LOCATION_UNSUPPORTED}"
      !insertmacro OneKeyInstallerMessage MB_OK|MB_ICONSTOP|MB_SETFOREGROUND \
        "OneKey Setup cannot automatically migrate this older installation from its current folder. Your files are intact. Contact OneKey Support for help." \
        "OneKey 安装程序无法自动迁移此位置的旧版安装。您的文件仍然完整。请联系 OneKey 客服获取帮助。"
    ${ElseIf} ${RESULT} == "${ONEKEY_RECOVERY_MACHINE_LEGACY_OWNERSHIP_UNVERIFIED}"
      !insertmacro OneKeyInstallerMessage MB_OK|MB_ICONSTOP|MB_SETFOREGROUND \
        "OneKey could not verify that the all-users installation folder is protected from changes by standard Windows users. Contact OneKey Support for help." \
        "OneKey 无法确认所有用户的安装文件夹受到保护，无法被标准 Windows 用户修改。请联系 OneKey 客服获取帮助。"
    !ifndef BUILD_UNINSTALLER
    ${ElseIf} ${RESULT} == "${ONEKEY_RECOVERY_TARGET_NOT_EMPTY}"
      !insertmacro OneKeyInstallerMessage MB_OK|MB_ICONSTOP|MB_SETFOREGROUND \
        "The selected OneKey installation folder already contains files. Choose an empty folder and run Setup again." \
        "所选 OneKey 安装文件夹中已有文件。请选择空文件夹后重新运行安装程序。"
    !endif
    ${EndIf}
  ${EndIf}
!macroend

!macro OneKeyRecoveryReadJournalValue ROOT KEY NAME OUT
  # Treat unreadable or malformed journals as pending. Only a missing key or
  # value permits an installer or uninstaller to continue without recovery.
  System::Call 'Advapi32::RegGetValueW(p ${ROOT}, w "${KEY}", w "${NAME}", i 0x00010008, p 0, p 0, *i 0)i .s'
  Pop ${OUT}
  ${If} ${OUT} == 2
  ${OrIf} ${OUT} == 3
    StrCpy ${OUT} "0"
  ${Else}
    StrCpy ${OUT} "1"
  ${EndIf}
!macroend

!macro OneKeyRecoveryReadJournal ROOT KEY OUT
  !insertmacro OneKeyRecoveryReadJournalValue ${ROOT} "${KEY}" TransactionV1 ${OUT}
!macroend

!ifdef BUILD_UNINSTALLER
  !define ONEKEY_RECOVERY_CURRENT_SID un.OneKeyRecoveryReadCurrentSid
  !define ONEKEY_RECOVERY_OUTER_STATE un.OneKeyRecoveryReadOuterState
!else
  !define ONEKEY_RECOVERY_CURRENT_SID OneKeyRecoveryReadCurrentSid
  !define ONEKEY_RECOVERY_OUTER_STATE OneKeyRecoveryReadOuterState
!endif

Function ${ONEKEY_RECOVERY_CURRENT_SID}
  Push $0
  Push $1
  Push $2
  Push $3
  StrCpy $R9 ""
  System::Call 'Advapi32::OpenProcessToken(p -1, i 8, *p .r0)i .r1'
  ${If} $1 != 0
    System::Alloc 128
    Pop $2
    ${If} $2 != 0
      # TOKEN_USER contains a pointer to the SID, which is at most 68 bytes.
      System::Call 'Advapi32::GetTokenInformation(p r0, i 1, p r2, i 128, *i .r3)i .r1'
      ${If} $1 != 0
        System::Call '*$2(p .r3)'
        System::Call 'Advapi32::ConvertSidToStringSidW(p r3, *p .r3)i .r1'
        ${If} $1 != 0
          System::Call 'Kernel32::lstrcpynW(w .R9, p r3, i ${NSIS_MAX_STRLEN})p'
          System::Call 'Kernel32::LocalFree(p r3)'
        ${EndIf}
      ${EndIf}
      System::Free $2
    ${EndIf}
    System::Call 'Kernel32::CloseHandle(p r0)'
  ${EndIf}
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

!macro OneKeyRecoveryReadUserRegistration FLAGS KEY VALUE
  System::Call 'Advapi32::RegGetValueW(p 0x80000001, w "${KEY}", w "${VALUE}", i ${FLAGS}, p 0, p 0, *i 0)i .s'
  Pop $8
  ${If} $8 == 0
    Push $R9
    Call ${ONEKEY_RECOVERY_CURRENT_SID}
    StrCpy $9 "$R9"
    Pop $R9
    StrCpy $8 "registered"
    Return
  ${ElseIf} $8 != 2
  ${AndIf} $8 != 3
    StrCpy $8 "unavailable"
    Return
  ${EndIf}
!macroend

!macro OneKeyRecoveryDefineOuterState
  Function ${ONEKEY_RECOVERY_OUTER_STATE}
    # Return status and SID in the UAC plug-in's first synchronization bank.
    SetShellVarContext current
    StrCpy $7 "$APPDATA"
    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
    StrCpy $9 ""
    !insertmacro OneKeyRecoveryReadJournal 0x80000001 "${ONEKEY_RECOVERY_JOURNAL_KEY}" $8
    ${If} $8 == "1"
      StrCpy $8 "pending"
      Return
    ${EndIf}
    !insertmacro OneKeyRecoveryReadJournalValue 0x80000001 "${ONEKEY_RECOVERY_JOURNAL_KEY}" UninstallTransactionV1 $8
    ${If} $8 == "1"
      StrCpy $8 "pending"
      Return
    ${EndIf}
    # Check both registry views without reading any registered install paths.
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0001ffff "${INSTALL_REGISTRY_KEY}" InstallLocation
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0002ffff "${INSTALL_REGISTRY_KEY}" InstallLocation
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0001ffff "${UNINSTALL_REGISTRY_KEY}" UninstallString
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0002ffff "${UNINSTALL_REGISTRY_KEY}" UninstallString
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0001ffff "${UNINSTALL_REGISTRY_KEY}" QuietUninstallString
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0002ffff "${UNINSTALL_REGISTRY_KEY}" QuietUninstallString
    !ifdef UNINSTALL_REGISTRY_KEY_2
      !insertmacro OneKeyRecoveryReadUserRegistration 0x0001ffff "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
      !insertmacro OneKeyRecoveryReadUserRegistration 0x0002ffff "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
      !insertmacro OneKeyRecoveryReadUserRegistration 0x0001ffff "${UNINSTALL_REGISTRY_KEY_2}" QuietUninstallString
      !insertmacro OneKeyRecoveryReadUserRegistration 0x0002ffff "${UNINSTALL_REGISTRY_KEY_2}" QuietUninstallString
    !endif
    # Cleanup still belongs to the initiating user after uninstall registration is removed.
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0001ffff "${ONEKEY_RECOVERY_JOURNAL_KEY}" PendingCleanupV1
    StrCpy $8 "clear"
  FunctionEnd
!macroend

!macro OneKeyRecoveryGuardInitiatingUser
  ${If} ${UAC_IsInnerInstance}
    Push $R7
    Push $R9
    Push $7
    Push $8
    Push $9
    # The elevated token may belong to a different account and see other HKCU
    # keys. Read the initiating account without trusting its paths in this one.
    StrCpy $8 ""
    StrCpy $9 ""
    StrCpy $7 ""
    ClearErrors
    !insertmacro UAC_AsUser_Call Function ${ONEKEY_RECOVERY_OUTER_STATE} ${UAC_SYNCREGISTERS}
    ${If} ${Errors}
      StrCpy $8 "unavailable"
    ${ElseIf} $8 == "registered"
      Call ${ONEKEY_RECOVERY_CURRENT_SID}
      ${If} $9 != ""
      ${AndIf} $9 == $R9
        StrCpy $8 "clear"
      ${EndIf}
    ${EndIf}
    StrCpy $OneKeyRecoveryInitiatingAppData "$7"
    ${If} $8 != "clear"
      ${If} $8 == "pending"
        StrCpy $R7 "Run OneKey Setup from the Windows account that started this operation to finish its pending update."
      ${ElseIf} $8 == "registered"
        StrCpy $R7 "The Windows account that started this operation has a current-user OneKey installation. Use that account to update it, or use the same account's administrator credentials for an all-users change."
      ${Else}
        StrCpy $R7 "OneKey Setup could not verify the Windows account that started this operation."
      ${EndIf}
      DetailPrint "$R7"
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONSTOP|MB_SETFOREGROUND "$R7"
      ${EndIf}
      SetErrorLevel 1
      Quit
    ${EndIf}
    Pop $9
    Pop $8
    Pop $7
    Pop $R9
    Pop $R7
    ClearErrors
  ${EndIf}
!macroend

!ifdef BUILD_UNINSTALLER
  Var OneKeyRecoveryUninstallMutex

  Var OneKeyUninstallToken
  Var OneKeyUninstallTarget
  Var OneKeyUninstallScope
  Var OneKeyUninstallOwnerPid
  Var OneKeyUninstallCommitted
  Var OneKeyUninstallPathErrorReported

  Function un.OneKeyRecoveryFail
    SetErrorLevel 1
    Call un.OneKeyModernShowUninstallFailure
    Abort "OneKey could not finish uninstalling. Run OneKey Setup or retry from Installed apps."
  FunctionEnd

  !macro OneKeyRecoveryReadUninstallRequest
    ${GetParameters} $0
    ClearErrors
    ${GetOptions} $0 "/ONEKEY_UNINSTALL_TOKEN=" $OneKeyUninstallToken
    ${IfNot} ${Errors}
      StrLen $1 $OneKeyUninstallToken
      System::Call 'Shlwapi::StrSpnW(w "$OneKeyUninstallToken", w "0123456789abcdef") i .r2'
      ${If} $1 != ${ONEKEY_RECOVERY_TOKEN_CHARS}
      ${OrIf} $2 != $1
      ${OrIfNot} ${Silent}
        Call un.OneKeyRecoveryFail
      ${EndIf}
      ${GetOptions} $0 "/ONEKEY_UNINSTALL_TARGET=" $OneKeyUninstallTarget
      ${If} $OneKeyUninstallTarget == ""
        Call un.OneKeyRecoveryFail
      ${EndIf}
    ${EndIf}
    ClearErrors
  !macroend

  !macro OneKeyRecoveryExecuteUninstall COMMAND
    SetOutPath "$TEMP"
    StrCpy $R8 ""
    !if "${COMMAND}" == "uninstall-prepare"
      ${If} $OneKeyUninstallToken != ""
        StrCpy $R8 "--token $OneKeyUninstallToken"
      ${EndIf}
    !endif
    nsExec::ExecToStack '"$PLUGINSDIR\OneKeyInstallerDirectoryRecovery.exe" ${COMMAND} --scope $OneKeyUninstallScope --target "$OneKeyUninstallTarget" --release "${VERSION}" --owner-pid $OneKeyUninstallOwnerPid --initiating-app-data "$OneKeyRecoveryInitiatingAppData" $R8'
    Pop $R9
    Pop $R8
    ${If} $R9 != "0"
      DetailPrint "$R8"
      ${If} $R9 == "${ONEKEY_RECOVERY_UNSUPPORTED_LOCATION}"
      ${OrIf} $R9 == "${ONEKEY_RECOVERY_WALLET_DATA_OVERLAP}"
      ${OrIf} $R9 == "${ONEKEY_RECOVERY_HISTORICAL_LOCATION_UNSUPPORTED}"
      ${OrIf} $R9 == "${ONEKEY_RECOVERY_MACHINE_LEGACY_OWNERSHIP_UNVERIFIED}"
        StrCpy $OneKeyUninstallPathErrorReported "1"
      ${EndIf}
      !insertmacro OneKeyRecoveryReportPathError $R9
      ${If} $R9 == "${ONEKEY_RECOVERY_MACHINE_LEGACY_OWNERSHIP_UNVERIFIED}"
        SetErrorLevel 1
        Quit
      ${EndIf}
      Call un.OneKeyRecoveryFail
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryInitUninstall
    StrCpy $OneKeyUninstallPathErrorReported "0"
    ${If} $OneKeyUninstallToken == ""
      StrCpy $OneKeyUninstallTarget "$INSTDIR"
    ${EndIf}
    StrCpy $OneKeyUninstallScope "user"
    ${If} $installMode == "all"
      StrCpy $OneKeyUninstallScope "machine"
    ${EndIf}
    System::Call 'Kernel32::GetCurrentProcessId() i .s'
    Pop $OneKeyUninstallOwnerPid
    ClearErrors
    SetOutPath "$PLUGINSDIR"
    File /oname=OneKeyInstallerDirectoryRecovery.exe "${ONEKEY_RECOVERY_HELPER}"
    ${If} ${Errors}
      Call un.OneKeyRecoveryFail
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryPrepareUninstall
    !insertmacro OneKeyRecoveryExecuteUninstall uninstall-prepare
    StrCpy $INSTDIR "$OneKeyUninstallTarget"
    StrCpy $OneKeyUninstallCommitted "1"
  !macroend

  !macro OneKeyRecoveryFinishUninstall
    ${If} $OneKeyUninstallCommitted == "1"
      !insertmacro OneKeyRecoveryExecuteUninstall uninstall-finish
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryReadEnrollment OUT
    StrCpy $0 0x80000001
    ${If} $installMode == "all"
      StrCpy $0 0x80000002
    ${EndIf}
    System::Call 'Advapi32::RegGetValueW(p r0, w "${ONEKEY_RECOVERY_JOURNAL_KEY}", w "InventoryEnrolledV1", i 0x00010010, p 0, *i .r1, *i 4)i .r2'
    ${If} $2 == 2
    ${OrIf} $2 == 3
      StrCpy ${OUT} 0
    ${ElseIf} $2 == 0
    ${AndIf} $1 == 1
      StrCpy ${OUT} 1
    ${Else}
      Call un.OneKeyRecoveryFail
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryGuardLegacyUninstall
    !insertmacro OneKeyRecoveryReadJournalValue 0x80000001 "${ONEKEY_RECOVERY_JOURNAL_KEY}" UninstallTransactionV1 $0
    !insertmacro OneKeyRecoveryReadJournalValue 0x80000002 "${ONEKEY_RECOVERY_JOURNAL_KEY}" UninstallTransactionV1 $1
    ${If} $0 == "1"
    ${OrIf} $1 == "1"
      Call un.OneKeyRecoveryFail
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryLockUninstall
    # Match the helper's lock and retain it until uninstall exits. An installer
    # cannot create a journal between the uninstaller's check and deletion.
    System::Call 'Kernel32::CreateMutexW(p 0, i 0, w "${ONEKEY_RECOVERY_MUTEX}") p .s'
    Pop $OneKeyRecoveryUninstallMutex
    System::Call 'Kernel32::WaitForSingleObject(p $OneKeyRecoveryUninstallMutex, i 5000)i .r0'
    ${If} $0 != 0
    ${AndIf} $0 != 128
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONSTOP "Wait for OneKey Setup to close before uninstalling OneKey."
      ${EndIf}
      SetErrorLevel 1
      Quit
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryGuardUninstall DIRECTORY
    !insertmacro OneKeyRecoveryReadJournal 0x80000001 "${ONEKEY_RECOVERY_JOURNAL_KEY}" $0
    !insertmacro OneKeyRecoveryReadJournal 0x80000002 "${ONEKEY_RECOVERY_JOURNAL_KEY}" $1
    ${If} $0 == "1"
    ${OrIf} $1 == "1"
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONSTOP "Run OneKey Setup to finish updating before uninstalling OneKey."
      ${EndIf}
      SetErrorLevel 1
      Quit
    ${EndIf}
    StrCpy $2 "${DIRECTORY}" 5 -37
    ${If} $2 == ".old-"
    ${OrIf} $2 == ".new-"
      StrCpy $3 "${DIRECTORY}" "" -${ONEKEY_RECOVERY_TOKEN_CHARS}
      System::Call 'Shlwapi::StrSpnW(w r3, w "0123456789abcdef") i .r2'
      ${If} $2 == ${ONEKEY_RECOVERY_TOKEN_CHARS}
        ${IfNot} ${Silent}
          MessageBox MB_OK|MB_ICONSTOP "To uninstall OneKey, open Installed apps in Windows Settings."
        ${EndIf}
        SetErrorLevel 1
        Quit
      ${EndIf}
    ${EndIf}
    ClearErrors
  !macroend
!else
  Var OneKeyRecoveryState
  Var OneKeyRecoveryScope
  Var OneKeyRecoveryTarget
  Var OneKeyRecoveryStage
  Var OneKeyRecoveryOwnerPid
  Var OneKeyRecoveryResult
  Var OneKeyRecoveryOutput
  Var OneKeyRecoveryResumed
  Var OneKeyRecoveryReadyToLaunch
  Var OneKeyRecoveryVerifiedUpgrade

  !macro OneKeyRecoveryExecute COMMAND
    # Windows holds the process's working directory open across child calls.
    # The helper needs to rename both the staging and registered directories.
    SetOutPath "$PLUGINSDIR"
    nsExec::ExecToStack '"$PLUGINSDIR\OneKeyInstallerDirectoryRecovery.exe" ${COMMAND} --scope $OneKeyRecoveryScope --target "$OneKeyRecoveryTarget" --release "${VERSION}" --owner-pid $OneKeyRecoveryOwnerPid --new-inventory "$PLUGINSDIR\${ONEKEY_RECOVERY_CARRIER}" --initiating-app-data "$OneKeyRecoveryInitiatingAppData"'
    Pop $OneKeyRecoveryResult
    Pop $OneKeyRecoveryOutput
    ${If} $OneKeyRecoveryResult != "0"
    ${AndIf} $OneKeyRecoveryOutput != ""
      DetailPrint "$OneKeyRecoveryOutput"
    ${EndIf}
  !macroend

  Function OneKeyRecoveryFail
    !insertmacro OneKeyRecoveryReportPathError $OneKeyRecoveryResult
    ${If} $OneKeyRecoveryResult == "${ONEKEY_RECOVERY_MACHINE_LEGACY_OWNERSHIP_UNVERIFIED}"
      SetErrorLevel 1
      Quit
    ${EndIf}
    ${If} $OneKeyRecoveryState == "staging"
      StrCpy $INSTDIR "$OneKeyRecoveryTarget"
      SetOutPath "$PLUGINSDIR"
      !insertmacro OneKeyRecoveryExecute recover
    ${EndIf}
    DetailPrint "OneKey Setup could not complete installation. Run Setup again to retry recovery."
    SetErrorLevel 1
    Call OneKeyModernShowInstallFailure
    Abort
  FunctionEnd

  Function OneKeyRecoveryResumeUninstall
    Pop $3
    Pop $4
    StrCpy $R7 "$OneKeyRecoveryOutput" ${ONEKEY_RECOVERY_TOKEN_CHARS}
    System::Call 'Shlwapi::StrSpnW(w R7, w "0123456789abcdef") i .r1'
    StrCmp $1 ${ONEKEY_RECOVERY_TOKEN_CHARS} 0 WorkerFailed
    # A committed ARM64 legacy tombstone can outlive its InstallLocation.
    StrCpy $1 "$OneKeyRecoveryOutput" 4 ${ONEKEY_RECOVERY_TOKEN_CHARS}
    ${If} $1 == " x86"
      ${If} $OneKeyRecoveryScope != "machine"
        Goto WorkerFailed
      ${EndIf}
      StrCpy $OneKeyRecoveryTarget "$PROGRAMFILES32\${APP_FILENAME}"
    ${EndIf}

    # Keep the private directory and verified executable at the same paths
    # until the worker exits. Use the directory's final path for every access.
    System::Call 'Kernel32::CreateFileW(w "$PLUGINSDIR", i 0x80, i 3, p 0, i 3, i 0x02200000, p 0)p .R4'
    StrCmp $R4 -1 WorkerFailed
    System::Call 'Kernel32::GetFileAttributesW(w "$PLUGINSDIR")i .r0'
    IntOp $0 $0 & 0x410
    StrCmp $0 16 0 WorkerCloseDirectory
    System::Call 'Kernel32::GetFinalPathNameByHandleW(p R4, w .R5, i ${NSIS_MAX_STRLEN}, i 0)i .r0'
    ${If} $0 == 0
    ${OrIf} $0 >= ${NSIS_MAX_STRLEN}
      Goto WorkerCloseDirectory
    ${EndIf}
    StrCpy $R5 $R5 "" 4
    System::Call 'Kernel32::GetLongPathNameW(w "$PLUGINSDIR", w .R6, i ${NSIS_MAX_STRLEN})i .r0'
    ${If} $0 == 0
    ${OrIf} $0 >= ${NSIS_MAX_STRLEN}
    ${OrIf} $R5 != $R6
      Goto WorkerCloseDirectory
    ${EndIf}

    StrCpy $R8 "$R5\onekey-uninstall-recovery.exe"
    System::Call 'Kernel32::CopyFileW(w "$OneKeyRecoveryTarget.uninstall-$R7\$3", w R8, i 1)i .r2'
    StrCmp $2 0 WorkerCloseDirectory
    System::Call 'Kernel32::CreateFileW(w R8, i 0x80000000, i 1, p 0, i 3, i 0x00200000, p 0)p .R9'
    StrCmp $R9 -1 WorkerCloseDirectory
    System::Call 'Kernel32::GetFileAttributesW(w R8)i .r0'
    IntOp $0 $0 & 0x410
    StrCmp $0 0 0 WorkerCloseFile
    nsExec::ExecToStack '"$R5\OneKeyInstallerDirectoryRecovery.exe" verify-uninstall-worker --scope $OneKeyRecoveryScope --target "$OneKeyRecoveryTarget" --release "${VERSION}" --owner-pid $OneKeyRecoveryOwnerPid --token $R7 --worker "$R8"'
    Pop $0
    Pop $OneKeyRecoveryOutput
    ${If} $0 != "0"
      DetailPrint "$OneKeyRecoveryOutput"
      Goto WorkerCloseFile
    ${EndIf}

    StrCpy $1 "/currentuser"
    ${If} $OneKeyRecoveryScope == "machine"
      StrCpy $1 "/allusers"
    ${EndIf}
    ClearErrors
    ExecWait '"$R8" /S /KEEP_APP_DATA $1 /ONEKEY_UNINSTALL_TOKEN=$R7 /ONEKEY_UNINSTALL_TARGET="$OneKeyRecoveryTarget" _?=$R5' $2
    ${If} ${Errors}
    ${OrIf} $2 != 0
      Goto WorkerCloseFile
    ${EndIf}
    System::Call 'Kernel32::CloseHandle(p R9)'
    Delete "$R8"
    System::Call 'Kernel32::CloseHandle(p R4)'
    DetailPrint "OneKey finished the previous uninstall. Run OneKey Setup again to install OneKey."
    ${IfNot} ${Silent}
      !insertmacro OneKeyInstallerMessage MB_OK|MB_ICONINFORMATION|MB_SETFOREGROUND \
        "OneKey finished the previous uninstall. Run OneKey Setup again to install OneKey." \
        "OneKey 已完成上次未完成的卸载。请重新运行 OneKey 安装程序以安装 OneKey。"
      SetErrorLevel 0
    ${Else}
      SetErrorLevel $4
    ${EndIf}
    Quit

  WorkerCloseFile:
    System::Call 'Kernel32::CloseHandle(p R9)'
  WorkerCloseDirectory:
    System::Call 'Kernel32::CloseHandle(p R4)'
  WorkerFailed:
    Call OneKeyRecoveryFail
  FunctionEnd

  !macro OneKeyRecoveryResumeUninstall
    ${If} ${isUpdated}
      Push "${ONEKEY_RECOVERY_UNINSTALL_COMPLETED}"
    ${Else}
      Push "0"
    ${EndIf}
    Push "${UNINSTALL_FILENAME}"
    Call OneKeyRecoveryResumeUninstall
  !macroend

  !macro OneKeyRecoveryRunLegacyMachineUninstaller
    StrCpy $R0 "0"
    ${If} $keepShortcuts == "true"
      StrCpy $R0 "1"
    ${EndIf}
    SetOutPath "$PLUGINSDIR"
    nsExec::ExecToStack '"$PLUGINSDIR\OneKeyInstallerDirectoryRecovery.exe" run-legacy-uninstaller --scope machine --target "$OneKeyRecoveryTarget" --release "${VERSION}" --owner-pid $OneKeyRecoveryOwnerPid --keep-shortcuts $R0 --initiating-app-data "$OneKeyRecoveryInitiatingAppData"'
    Pop $OneKeyRecoveryResult
    Pop $OneKeyRecoveryOutput
    ${If} $OneKeyRecoveryResult != "0"
      DetailPrint "$OneKeyRecoveryOutput"
      Call OneKeyRecoveryFail
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryBegin
    StrCpy $OneKeyRecoveryState "legacy"
    StrCpy $OneKeyRecoveryResumed "0"
    StrCpy $OneKeyRecoveryReadyToLaunch "0"
    StrCpy $OneKeyRecoveryVerifiedUpgrade "0"
    StrCpy $OneKeyRecoveryScope "user"
    ${If} $installMode == "all"
      !insertmacro OneKeyRecoveryGuardInitiatingUser
      StrCpy $OneKeyRecoveryScope "machine"
    ${EndIf}
    ${If} $OneKeyModernRecoveryScope == "all"
    ${AndIf} $OneKeyRecoveryScope != "machine"
      Call OneKeyRecoveryFail
    ${ElseIf} $OneKeyModernRecoveryScope == "current"
    ${AndIf} $OneKeyRecoveryScope != "user"
      Call OneKeyRecoveryFail
    ${EndIf}
    StrCpy $OneKeyRecoveryTarget "$INSTDIR"
    System::Call 'Kernel32::GetCurrentProcessId() i .s'
    Pop $OneKeyRecoveryOwnerPid

    ClearErrors
    SetOutPath "$PLUGINSDIR"
    File /oname=OneKeyInstallerDirectoryRecovery.exe "${ONEKEY_RECOVERY_HELPER}"
    !ifdef ONEKEY_RECOVERY_INVENTORY
      File /oname=${ONEKEY_RECOVERY_CARRIER} "${ONEKEY_RECOVERY_INVENTORY}"
    !else
      !insertmacro identify_package
      ${If} $packageArch == "ARM64"
        !ifdef ONEKEY_RECOVERY_INVENTORY_ARM64
          File /oname=${ONEKEY_RECOVERY_CARRIER} "${ONEKEY_RECOVERY_INVENTORY_ARM64}"
        !endif
      ${ElseIf} $packageArch == "64"
        !ifdef ONEKEY_RECOVERY_INVENTORY_64
          File /oname=${ONEKEY_RECOVERY_CARRIER} "${ONEKEY_RECOVERY_INVENTORY_64}"
        !endif
      ${Else}
        !ifdef ONEKEY_RECOVERY_INVENTORY_32
          File /oname=${ONEKEY_RECOVERY_CARRIER} "${ONEKEY_RECOVERY_INVENTORY_32}"
        !endif
      ${EndIf}
    !endif
    ${If} ${Errors}
    ${OrIfNot} ${FileExists} "$PLUGINSDIR\${ONEKEY_RECOVERY_CARRIER}"
      Call OneKeyRecoveryFail
    ${EndIf}

    !insertmacro OneKeyRecoveryExecute recover
    ${If} $OneKeyRecoveryResult == "14"
      !insertmacro OneKeyRecoveryResumeUninstall
    ${EndIf}
    ${If} $OneKeyRecoveryResult == "12"
      StrCpy $OneKeyRecoveryState "published"
      StrCpy $OneKeyRecoveryResumed "1"
    ${ElseIf} $OneKeyRecoveryResult != "10"
    ${AndIf} $OneKeyRecoveryResult != "11"
      Call OneKeyRecoveryFail
    ${EndIf}
    ClearErrors
  !macroend

  !macro OneKeyRecoveryPrepare
    ${If} $OneKeyRecoveryScope == "machine"
      !insertmacro OneKeyRecoveryGuardInitiatingUser
    ${EndIf}
    ${If} $OneKeyRecoveryState == "legacy"
      StrCpy $OneKeyRecoveryState "staging"
      !insertmacro OneKeyRecoveryExecute prepare
      ${If} $OneKeyRecoveryResult == "0"
        StrCpy $0 "$OneKeyRecoveryOutput" ${ONEKEY_RECOVERY_TOKEN_CHARS}
        System::Call 'Shlwapi::StrSpnW(w r0, w "0123456789abcdef") i .r1'
        ${If} $1 != ${ONEKEY_RECOVERY_TOKEN_CHARS}
          Call OneKeyRecoveryFail
        ${EndIf}
        StrCpy $OneKeyRecoveryStage "$OneKeyRecoveryTarget.new-$0"
      ${ElseIf} $OneKeyRecoveryResult == "10"
        StrCpy $OneKeyRecoveryState "legacy"
      ${Else}
        Call OneKeyRecoveryFail
      ${EndIf}
    ${EndIf}
    ClearErrors
  !macroend

  !macro OneKeyRecoveryBeforeFiles
    ClearErrors
    ${If} $OneKeyRecoveryState == "published"
      SetOutPath "$OneKeyRecoveryTarget"
      !insertmacro OneKeyRecoveryCheckErrors
      Goto OneKeyRecoveryFilesReady
    ${ElseIf} $OneKeyRecoveryState == "staging"
      StrCpy $INSTDIR "$OneKeyRecoveryStage"
      # Put the signed inventory in place before any payload entries are copied.
      CopyFiles /SILENT /FILESONLY "$PLUGINSDIR\${ONEKEY_RECOVERY_CARRIER}" "$INSTDIR"
      !insertmacro OneKeyRecoveryHandleFileErrors
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryHandleFileErrors
    ${If} $OneKeyRecoveryState == "staging"
    ${AndIf} ${Errors}
      Call OneKeyRecoveryFail
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryAfterFiles
    !insertmacro OneKeyRecoveryHandleFileErrors
    ClearErrors
    ${If} $OneKeyRecoveryState == "legacy"
      CopyFiles /SILENT /FILESONLY "$PLUGINSDIR\${ONEKEY_RECOVERY_CARRIER}" "$INSTDIR"
      ${If} ${Errors}
        Call OneKeyRecoveryFail
      ${EndIf}
    ${EndIf}
    ${If} $OneKeyRecoveryState == "staging"
      StrCpy $INSTDIR "$OneKeyRecoveryTarget"
      !insertmacro OneKeyRecoveryExecute promote
      ${If} $OneKeyRecoveryResult != "0"
        Call OneKeyRecoveryFail
      ${EndIf}
      StrCpy $OneKeyRecoveryState "published"
      ClearErrors
      SetOutPath "$INSTDIR"
      !insertmacro OneKeyRecoveryCheckErrors
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryCheckErrors
    ${If} ${Errors}
    ${AndIf} $OneKeyRecoveryState != "legacy"
      Call OneKeyRecoveryFail
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryCheckRegistryValue ROOT KEY NAME VALUE
    ${If} $OneKeyRecoveryState == "published"
      ClearErrors
      ReadRegStr $R8 ${ROOT} "${KEY}" "${NAME}"
      ${If} ${Errors}
      ${OrIf} $R8 != '${VALUE}'
        Call OneKeyRecoveryFail
      ${EndIf}
    ${EndIf}
  !macroend

  !macro OneKeyRecoveryFinishShortcuts
    ${If} $OneKeyRecoveryState == "published"
      ${If} $keepShortcuts == "false"
        !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
          ${If} $oldStartMenuLink != $newStartMenuLink
          ${AndIf} ${FileExists} "$oldStartMenuLink"
            WinShell::UninstShortcut "$oldStartMenuLink"
            ClearErrors
            Delete "$oldStartMenuLink"
            !insertmacro OneKeyRecoveryCheckErrors
          ${EndIf}
        !endif
        !ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT
          ${If} $oldDesktopLink != $newDesktopLink
          ${OrIf} ${isNoDesktopShortcut}
            ${If} ${FileExists} "$oldDesktopLink"
              WinShell::UninstShortcut "$oldDesktopLink"
              ClearErrors
              Delete "$oldDesktopLink"
              !insertmacro OneKeyRecoveryCheckErrors
            ${EndIf}
          ${EndIf}
        !endif
      ${EndIf}
      !ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT
        ${If} $OneKeyRecoveryResumed == "1"
        ${AndIf} $keepShortcuts == "true"
        ${AndIf} $oldDesktopLink != $newDesktopLink
        ${AndIfNot} ${FileExists} "$oldDesktopLink"
        ${AndIfNot} ${isNoDesktopShortcut}
        ${AndIf} ${FileExists} "$newDesktopLink"
          ClearErrors
          WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
          !insertmacro OneKeyRecoveryCheckErrors
        ${EndIf}
      !endif
      !ifndef MENU_FILENAME
        ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" MenuDirectory
        ${IfNot} ${Errors}
          DeleteRegValue SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" MenuDirectory
          !insertmacro OneKeyRecoveryCheckErrors
        ${EndIf}
      !endif
    ${EndIf}
    ClearErrors
  !macroend

  !macro OneKeyRecoveryCheckRegistration
    !insertmacro OneKeyRecoveryCheckErrors
    !insertmacro OneKeyRecoveryCheckRegistryValue SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" KeepShortcuts "true"
    !insertmacro OneKeyRecoveryCheckRegistryValue SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" ShortcutName "${SHORTCUT_NAME}"
    !ifdef MENU_FILENAME
      !insertmacro OneKeyRecoveryCheckRegistryValue SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" MenuDirectory "${MENU_FILENAME}"
    !endif
    !insertmacro OneKeyRecoveryCheckRegistryValue SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" DisplayName "${UNINSTALL_DISPLAY_NAME}"
    ClearErrors
  !macroend

  !macro OneKeyRecoveryFinish
    ${If} $OneKeyRecoveryState == "published"
      !insertmacro OneKeyRecoveryExecute commit
      ${If} $OneKeyRecoveryResult != "0"
        Call OneKeyRecoveryFail
      ${EndIf}
    ${Else}
      !insertmacro OneKeyRecoveryExecute enroll
      ${If} $OneKeyRecoveryResult != "0"
      ${AndIf} $OneKeyRecoveryResult != "10"
        Call OneKeyRecoveryFail
      ${EndIf}
    ${EndIf}
    StrCpy $OneKeyRecoveryReadyToLaunch "1"
    SetOutPath "$INSTDIR"
    ClearErrors
  !macroend
!endif
!endif
