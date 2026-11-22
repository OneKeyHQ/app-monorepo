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

!macro OneKeyRecoveryReadJournal ROOT KEY OUT
  # Treat unreadable or malformed journals as pending. Only a missing key or
  # value permits an installer or uninstaller to continue without recovery.
  System::Call 'Advapi32::RegGetValueW(p ${ROOT}, w "${KEY}", w "TransactionV1", i 0x00010008, p 0, p 0, *i 0)i .s'
  Pop ${OUT}
  ${If} ${OUT} == 2
  ${OrIf} ${OUT} == 3
    StrCpy ${OUT} "0"
  ${Else}
    StrCpy ${OUT} "1"
  ${EndIf}
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
    StrCpy $9 ""
    !insertmacro OneKeyRecoveryReadJournal 0x80000001 "${ONEKEY_RECOVERY_JOURNAL_KEY}" $8
    ${If} $8 == "1"
      StrCpy $8 "pending"
      Return
    ${EndIf}
    # Check both registry views without copying any user-controlled paths.
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0001ffff "${INSTALL_REGISTRY_KEY}" InstallLocation
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0002ffff "${INSTALL_REGISTRY_KEY}" InstallLocation
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0001ffff "${UNINSTALL_REGISTRY_KEY}" UninstallString
    !insertmacro OneKeyRecoveryReadUserRegistration 0x0002ffff "${UNINSTALL_REGISTRY_KEY}" UninstallString
    !ifdef UNINSTALL_REGISTRY_KEY_2
      !insertmacro OneKeyRecoveryReadUserRegistration 0x0001ffff "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
      !insertmacro OneKeyRecoveryReadUserRegistration 0x0002ffff "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
    !endif
    StrCpy $8 "clear"
  FunctionEnd
!macroend

!macro OneKeyRecoveryGuardInitiatingUser
  ${If} ${UAC_IsInnerInstance}
    Push $R7
    Push $R9
    Push $8
    Push $9
    # The elevated token may belong to a different account and see other HKCU
    # keys. Read the initiating account without trusting its paths in this one.
    StrCpy $8 ""
    StrCpy $9 ""
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
    Pop $R9
    Pop $R7
    ClearErrors
  ${EndIf}
!macroend

!ifdef BUILD_UNINSTALLER
  Var OneKeyRecoveryUninstallMutex

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

  !macro OneKeyRecoveryExecute COMMAND
    # Windows holds the process's working directory open across child calls.
    # The helper needs to rename both the staging and registered directories.
    SetOutPath "$PLUGINSDIR"
    nsExec::ExecToStack '"$PLUGINSDIR\OneKeyInstallerDirectoryRecovery.exe" ${COMMAND} --scope $OneKeyRecoveryScope --target "$OneKeyRecoveryTarget" --release "${VERSION}" --owner-pid $OneKeyRecoveryOwnerPid --new-inventory "$PLUGINSDIR\${ONEKEY_RECOVERY_CARRIER}"'
    Pop $OneKeyRecoveryResult
    Pop $OneKeyRecoveryOutput
    ${If} $OneKeyRecoveryResult != "0"
    ${AndIf} $OneKeyRecoveryOutput != ""
      DetailPrint "$OneKeyRecoveryOutput"
    ${EndIf}
  !macroend

  Function OneKeyRecoveryFail
    ${If} $OneKeyRecoveryState == "staging"
      StrCpy $INSTDIR "$OneKeyRecoveryTarget"
      !insertmacro OneKeyRecoveryExecute recover
    ${EndIf}
    DetailPrint "OneKey Setup could not complete installation. Run Setup again to retry recovery."
    SetErrorLevel 1
    Abort
  FunctionEnd

  !macro OneKeyRecoveryBegin
    StrCpy $OneKeyRecoveryState "legacy"
    StrCpy $OneKeyRecoveryResumed "0"
    StrCpy $OneKeyRecoveryReadyToLaunch "0"
    StrCpy $OneKeyRecoveryScope "user"
    ${If} $installMode == "all"
      !insertmacro OneKeyRecoveryGuardInitiatingUser
      StrCpy $OneKeyRecoveryScope "machine"
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
    CopyFiles /SILENT /FILESONLY "$PLUGINSDIR\${ONEKEY_RECOVERY_CARRIER}" "$INSTDIR"
    ${If} ${Errors}
      Call OneKeyRecoveryFail
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
