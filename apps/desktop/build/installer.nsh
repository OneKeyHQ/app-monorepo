# OneKey modern installer UI. The native NSIS window remains untouched until
# the plugin and the complete theme package have both initialized successfully.

!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "nsDialogs.nsh"
!include "WinVer.nsh"
!include "x64.nsh"
!if /FileExists "${BUILD_RESOURCES_DIR}\installer-generated\installer-config.nsh"
  !include "${BUILD_RESOURCES_DIR}\installer-generated\installer-config.nsh"
!endif
!ifdef ONEKEY_USE_UPDATE_STATUS
  !ifndef BUILD_UNINSTALLER
    !include "${PROJECT_DIR}\native\installer-update-status\update-status.nsh"
  !endif
!endif

!define ONEKEY_APP_USER_MODEL_ID "OneKey Wallet"
!define ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY "Software\Classes\AppUserModelId\${ONEKEY_APP_USER_MODEL_ID}"

!macro OneKeyDeleteProtocolKeyIfOwnedByDir ROOT_KEY SCHEME TARGET_DIR
  ${If} "${TARGET_DIR}" != ""
    ReadRegStr $R9 ${ROOT_KEY} "Software\Classes\${SCHEME}\shell\open\command" ""
    ${If} $R9 == '"${TARGET_DIR}\${APP_EXECUTABLE_FILENAME}" "--" "%1"'
    ${OrIf} $R9 == '"${TARGET_DIR}\${APP_EXECUTABLE_FILENAME}" "%1"'
      ClearErrors
      DeleteRegKey ${ROOT_KEY} "Software\Classes\${SCHEME}"
      !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
        !ifndef BUILD_UNINSTALLER
          !insertmacro OneKeyRecoveryCheckErrors
        !endif
      !endif
    ${EndIf}
    ClearErrors
  ${EndIf}
!macroend

!macro OneKeyUnregisterProtocolIfOwned ROOT_KEY SCHEME
  !insertmacro OneKeyDeleteProtocolKeyIfOwnedByDir ${ROOT_KEY} "${SCHEME}" "$INSTDIR"
  ${If} $installMode == "all"
    !ifdef INSTALL_MODE_PER_ALL_USERS_REQUIRED
      !insertmacro OneKeyDeleteProtocolKeyIfOwnedByDir ${ROOT_KEY} "${SCHEME}" "$perMachineInstallationFolder"
    !endif
  ${Else}
    !ifndef INSTALL_MODE_PER_ALL_USERS
      !insertmacro OneKeyDeleteProtocolKeyIfOwnedByDir ${ROOT_KEY} "${SCHEME}" "$perUserInstallationFolder"
    !endif
  ${EndIf}
!macroend

!macro OneKeyRegisterProtocolScheme SCHEME DESCRIPTION
  !insertmacro OneKeyUnregisterProtocolIfOwned HKCU "${SCHEME}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}" "" "${DESCRIPTION}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}\shell\open\command" "" '"$appExe" "--" "%1"'
  !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
    !insertmacro OneKeyRecoveryCheckErrors
    !insertmacro OneKeyRecoveryCheckRegistryValue SHELL_CONTEXT "Software\Classes\${SCHEME}\shell\open\command" "" '"$appExe" "--" "%1"'
  !endif
  ClearErrors
!macroend

!macro OneKeyUnregisterProtocolSchemes
  !insertmacro OneKeyUnregisterProtocolIfOwned SHELL_CONTEXT "onekey-wallet"
  !insertmacro OneKeyUnregisterProtocolIfOwned HKCU "onekey-wallet"
  !insertmacro OneKeyUnregisterProtocolIfOwned SHELL_CONTEXT "wc"
  !insertmacro OneKeyUnregisterProtocolIfOwned HKCU "wc"
  !insertmacro OneKeyUnregisterProtocolIfOwned SHELL_CONTEXT "ethereum"
  !insertmacro OneKeyUnregisterProtocolIfOwned HKCU "ethereum"
  ClearErrors
!macroend

Var OneKeyModernUiActive
Var OneKeyModernLocale
Var OneKeyModernResult
Var OneKeyModernIsInner

!include /CHARSET=UTF8 "${PROJECT_DIR}\native\installer-native-ui\renderer.nsh"
!ifdef ONEKEY_USE_DIRECTORY_RECOVERY
  !include /CHARSET=UTF8 "${PROJECT_DIR}\native\installer-directory-recovery\recovery.nsh"
!endif

!ifndef BUILD_UNINSTALLER
  !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
    Var OneKeyModernRecoveryScope
    !macro customHeader
      !insertmacro OneKeyRecoveryDefineOuterState
    !macroend
  !endif
  Var OneKeyModernInstallScope
  Var OneKeyModernWasInstalled
  Var OneKeyModernHadPerUser
  Var OneKeyModernHadPerMachine
  Var OneKeyModernExplicitScope
  Var OneKeyModernDisabled
  Var OneKeyModernIsAdmin
  Var OneKeyModernPerUserDirectory
  Var OneKeyModernPerMachineDirectory
  Var OneKeyModernCommandLineDirectory
  Var OneKeyModernChosenDirectory
  Var OneKeyModernAccepted
  Var OneKeyModernStartAppArgs
  Var OneKeyModernPackagePrepared
  Var OneKeyModernPackageArch

# Reject unsupported systems before loading the UI or replacing an old version.
!macro preInit
  ${IfNot} ${AtLeastWin10}
  ${OrIfNot} ${AtLeastBuild} 14393
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "OneKey requires Windows 10 version 1607 or later."
    ${EndIf}
    SetErrorLevel 1
    Quit
  ${EndIf}
!macroend

# Read the persisted installation state independently from initMultiUser's
# effective mode. A fresh install still receives a default directory there,
# which must not be mistaken for an existing installation.
!macro customInit
  StrCpy $OneKeyModernInstallScope ""
  StrCpy $OneKeyModernExplicitScope ""
  StrCpy $OneKeyModernDisabled "0"
  StrCpy $OneKeyModernIsAdmin "0"
  StrCpy $OneKeyModernHadPerUser "0"
  StrCpy $OneKeyModernHadPerMachine "0"
  StrCpy $OneKeyModernWasInstalled "0"
  StrCpy $OneKeyModernIsInner "0"
  StrCpy $OneKeyModernAccepted "0"
  StrCpy $OneKeyModernPackagePrepared "0"
  StrCpy $OneKeyModernChosenDirectory ""
  StrCpy $OneKeyModernPerUserDirectory ""
  StrCpy $OneKeyModernPerMachineDirectory ""
  StrCpy $OneKeyModernCommandLineDirectory ""
  ReadRegStr $OneKeyModernPerUserDirectory HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ReadRegStr $OneKeyModernPerMachineDirectory HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation

  ${If} ${UAC_IsInnerInstance}
    StrCpy $OneKeyModernIsInner "1"
    !insertmacro UAC_AsUser_GetGlobal $OneKeyModernAccepted $OneKeyModernAccepted
    !insertmacro UAC_AsUser_GetGlobal $OneKeyModernChosenDirectory $OneKeyModernChosenDirectory
    !insertmacro UAC_AsUser_GetGlobal $OneKeyModernInstallScope $OneKeyModernInstallScope
  ${EndIf}
  ${If} ${UAC_IsAdmin}
    StrCpy $OneKeyModernIsAdmin "1"
  ${EndIf}

  !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
    !insertmacro OneKeyRecoveryReadJournal 0x80000001 "${ONEKEY_RECOVERY_JOURNAL_KEY}" $2
    !insertmacro OneKeyRecoveryReadJournal 0x80000002 "${ONEKEY_RECOVERY_JOURNAL_KEY}" $3
    ${If} $2 == "0"
      !insertmacro OneKeyRecoveryReadJournalValue 0x80000001 "${ONEKEY_RECOVERY_JOURNAL_KEY}" UninstallTransactionV1 $2
    ${EndIf}
    ${If} $3 == "0"
      !insertmacro OneKeyRecoveryReadJournalValue 0x80000002 "${ONEKEY_RECOVERY_JOURNAL_KEY}" UninstallTransactionV1 $3
    ${EndIf}
  !endif

  ${If} $OneKeyModernPerUserDirectory != ""
  ${AndIf} ${FileExists} "$OneKeyModernPerUserDirectory\${UNINSTALL_FILENAME}"
    StrCpy $OneKeyModernHadPerUser "1"
    StrCpy $OneKeyModernWasInstalled "1"
  !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
  ${ElseIf} $OneKeyModernPerUserDirectory != ""
  ${AndIf} $2 == "1"
    StrCpy $OneKeyModernHadPerUser "1"
    StrCpy $OneKeyModernWasInstalled "1"
  !endif
  ${Else}
    StrCpy $OneKeyModernPerUserDirectory ""
  ${EndIf}
  ${If} $OneKeyModernPerMachineDirectory != ""
  ${AndIf} ${FileExists} "$OneKeyModernPerMachineDirectory\${UNINSTALL_FILENAME}"
    StrCpy $OneKeyModernHadPerMachine "1"
    StrCpy $OneKeyModernWasInstalled "1"
  !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
  ${ElseIf} $OneKeyModernPerMachineDirectory != ""
  ${AndIf} $3 == "1"
    StrCpy $OneKeyModernHadPerMachine "1"
    StrCpy $OneKeyModernWasInstalled "1"
  !endif
  ${Else}
    StrCpy $OneKeyModernPerMachineDirectory ""
  ${EndIf}

  ${GetParameters} $0
  ${GetOptions} $0 "/allusers" $1
  ${IfNot} ${Errors}
    StrCpy $OneKeyModernExplicitScope "all"
  ${EndIf}
  ${GetOptions} $0 "/currentuser" $1
  ${IfNot} ${Errors}
    ${If} $OneKeyModernExplicitScope == "all"
      StrCpy $OneKeyModernExplicitScope "both"
    ${Else}
      StrCpy $OneKeyModernExplicitScope "current"
    ${EndIf}
  ${EndIf}
  !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
    StrCpy $OneKeyModernRecoveryScope ""
    ${If} $2 == "1"
    ${AndIf} $3 == "1"
      StrCpy $OneKeyModernRecoveryScope "both"
    ${ElseIf} $2 == "1"
      StrCpy $OneKeyModernRecoveryScope "current"
    ${ElseIf} $3 == "1"
      StrCpy $OneKeyModernRecoveryScope "all"
    ${EndIf}
    ${If} $OneKeyModernRecoveryScope != ""
      ${If} $OneKeyModernRecoveryScope == "both"
        Goto OneKeyModernRecoveryScopeConflict
      ${EndIf}
      ${If} $OneKeyModernExplicitScope != ""
      ${AndIf} $OneKeyModernExplicitScope != $OneKeyModernRecoveryScope
        Goto OneKeyModernRecoveryScopeConflict
      ${EndIf}
      ${If} $OneKeyModernInstallScope != ""
      ${AndIf} $OneKeyModernInstallScope != $OneKeyModernRecoveryScope
        Goto OneKeyModernRecoveryScopeConflict
      ${EndIf}
      StrCpy $OneKeyModernInstallScope "$OneKeyModernRecoveryScope"
      StrCpy $OneKeyModernAccepted "1"
      StrCpy $OneKeyModernChosenDirectory ""
      ${If} $OneKeyModernRecoveryScope == "current"
        !ifndef INSTALL_MODE_PER_ALL_USERS
          !ifndef ONE_CLICK
            StrCpy $hasPerMachineInstallation "0"
            StrCpy $hasPerUserInstallation "1"
          !endif
          !insertmacro setInstallModePerUser
        !else
          Goto OneKeyModernRecoveryScopeConflict
        !endif
      ${Else}
        !ifndef INSTALL_MODE_PER_ALL_USERS
          !ifndef ONE_CLICK
            StrCpy $hasPerMachineInstallation "1"
            StrCpy $hasPerUserInstallation "0"
          !endif
        !endif
        !ifdef INSTALL_MODE_PER_ALL_USERS_REQUIRED
          !insertmacro setInstallModePerAllUsers
        !else
          Goto OneKeyModernRecoveryScopeConflict
        !endif
      ${EndIf}
    ${EndIf}
    Goto OneKeyModernRecoveryScopeReady

    OneKeyModernRecoveryScopeConflict:
      ${IfNot} ${Silent}
        !insertmacro OneKeyInstallerMessage MB_OK|MB_ICONSTOP|MB_SETFOREGROUND \
          "OneKey Setup could not select a scope for recovery. Run Setup again without a scope option or contact OneKey support." \
          "OneKey 安装程序无法确定要恢复的安装范围。请不指定安装范围重新运行安装程序，或联系 OneKey 支持。"
      ${EndIf}
      SetErrorLevel 1
      Quit

    OneKeyModernRecoveryScopeReady:
  !endif
  ${If} $OneKeyModernExplicitScope == "both"
    StrCpy $OneKeyModernExplicitScope "current"
  ${EndIf}
  # An explicit scope is an upgrade only when that scope is already installed.
  ${If} $OneKeyModernExplicitScope == "all"
    StrCpy $OneKeyModernWasInstalled "$OneKeyModernHadPerMachine"
  ${ElseIf} $OneKeyModernExplicitScope == "current"
    StrCpy $OneKeyModernWasInstalled "$OneKeyModernHadPerUser"
  ${EndIf}
  !insertmacro GetDParameter $OneKeyModernCommandLineDirectory

  # Keep fresh-install previews aligned with the hidden install-mode defaults.
  # The selected scope's resolved path is written back after that page so a
  # stale registry entry cannot override a fresh choice.
  ${If} $OneKeyModernPerUserDirectory == ""
    StrCpy $0 "$LocalAppData\Programs"
    Push $1
    Push $2
    StrCpy $2 0
    System::Call 'SHELL32::SHGetKnownFolderPath(g "${FOLDERID_UserProgramFiles}", i ${KF_FLAG_CREATE}, p 0, *p .r2)i.r1'
    ${If} $1 == 0
      System::Call 'KERNEL32::lstrcpynW(w .r0, p r2, i ${NSIS_MAX_STRLEN})p'
    ${EndIf}
    ${If} $2 != 0
      System::Call 'OLE32::CoTaskMemFree(p r2)'
    ${EndIf}
    Pop $2
    Pop $1
    StrCpy $OneKeyModernPerUserDirectory "$0\${APP_FILENAME}"
  ${EndIf}
  ${If} $OneKeyModernPerMachineDirectory == ""
    StrCpy $0 "$PROGRAMFILES"
    !ifdef APP_64 | APP_ARM64
      ${If} ${RunningX64}
      ${OrIf} ${IsNativeARM64}
        StrCpy $0 "$PROGRAMFILES64"
      ${EndIf}
    !endif
    !ifdef MENU_FILENAME
      StrCpy $0 "$0\${MENU_FILENAME}"
    !endif
    StrCpy $OneKeyModernPerMachineDirectory "$0\${APP_FILENAME}"
  ${EndIf}

  ${If} $OneKeyModernWasInstalled == "0"
  ${AndIf} $OneKeyModernCommandLineDirectory != ""
    StrCpy $OneKeyModernPerUserDirectory "$OneKeyModernCommandLineDirectory"
    StrCpy $OneKeyModernPerMachineDirectory "$OneKeyModernCommandLineDirectory"
  ${EndIf}

  ${If} $OneKeyModernExplicitScope != ""
    ${If} $OneKeyModernWasInstalled == "0"
      StrCpy $OneKeyModernAccepted "1"
      ${If} $OneKeyModernExplicitScope == "all"
        StrCpy $OneKeyModernChosenDirectory "$OneKeyModernPerMachineDirectory"
      ${Else}
        StrCpy $OneKeyModernChosenDirectory "$OneKeyModernPerUserDirectory"
      ${EndIf}
    ${EndIf}
  ${EndIf}
  !ifdef ONEKEY_USE_UPDATE_STATUS
    ; The outer instance of a silent per-machine install will hand off to UAC.
    ${If} $hasPerMachineInstallation != "1"
    ${OrIf} ${UAC_IsAdmin}
      !insertmacro OneKeyStartUpdateStatus ""
    ${EndIf}
  !endif
!macroend

# Hide the native NSIS host before its first frame is painted. Every modern
# UI initialization failure path restores it before falling back.
!define MUI_CUSTOMFUNCTION_GUIINIT OneKeyModernOnGuiInit
Function OneKeyModernOnGuiInit
  ${IfNot} ${Silent}
    ShowWindow $HWNDPARENT ${SW_HIDE}
  ${EndIf}
FunctionEnd

# MUI shows the native host again when it enters InstFiles. Hide it in the
# page's own show callback so there is no visible frame before the DLL timer.
Function OneKeyModernOnInstFilesShow
  ${If} $OneKeyModernUiActive == "1"
    ShowWindow $HWNDPARENT ${SW_HIDE}
  ${EndIf}
FunctionEnd

# The hidden electron-builder install-mode page remains authoritative for
# elevation, registry scope, and the default directory. The modern scope page
# only supplies a choice when the registry/command line did not already do so.
!macro customInstallMode
  ${If} $OneKeyModernInstallScope == "all"
    StrCpy $isForceMachineInstall "1"
  ${ElseIf} $OneKeyModernInstallScope == "current"
    StrCpy $isForceCurrentInstall "1"
  ${ElseIf} $OneKeyModernExplicitScope == "all"
    StrCpy $isForceMachineInstall "1"
  ${ElseIf} $OneKeyModernExplicitScope == "current"
    StrCpy $isForceCurrentInstall "1"
  ${ElseIf} $OneKeyModernHadPerMachine == "1"
  ${AndIf} $OneKeyModernHadPerUser == "0"
    StrCpy $isForceMachineInstall "1"
  ${ElseIf} $OneKeyModernHadPerUser == "1"
  ${AndIf} $OneKeyModernHadPerMachine == "0"
    StrCpy $isForceCurrentInstall "1"
  ${EndIf}
!macroend
!endif

!macro OneKeyModernSelectLocale
  StrCpy $OneKeyModernLocale "en-US"
  StrCpy $0 "$LANGUAGE"
  System::Call "kernel32::GetUserDefaultUILanguage() i .r0"
  IntOp $1 $0 & 1023

  ${If} $1 == 69
    StrCpy $OneKeyModernLocale "bn"
  ${ElseIf} $1 == 7
    StrCpy $OneKeyModernLocale "de"
  ${ElseIf} $1 == 9
    StrCpy $OneKeyModernLocale "en-US"
  ${ElseIf} $1 == 10
    StrCpy $OneKeyModernLocale "es"
  ${ElseIf} $1 == 12
    StrCpy $OneKeyModernLocale "fr-FR"
  ${ElseIf} $1 == 57
    StrCpy $OneKeyModernLocale "hi-IN"
  ${ElseIf} $1 == 33
    StrCpy $OneKeyModernLocale "id"
  ${ElseIf} $1 == 16
    StrCpy $OneKeyModernLocale "it-IT"
  ${ElseIf} $1 == 17
    StrCpy $OneKeyModernLocale "ja-JP"
  ${ElseIf} $1 == 18
    StrCpy $OneKeyModernLocale "ko-KR"
  ${ElseIf} $1 == 22
    ${If} $0 == 1046
      StrCpy $OneKeyModernLocale "pt-BR"
    ${Else}
      StrCpy $OneKeyModernLocale "pt"
    ${EndIf}
  ${ElseIf} $1 == 25
    StrCpy $OneKeyModernLocale "ru"
  ${ElseIf} $1 == 30
    StrCpy $OneKeyModernLocale "th-TH"
  ${ElseIf} $1 == 34
    StrCpy $OneKeyModernLocale "uk-UA"
  ${ElseIf} $1 == 42
    StrCpy $OneKeyModernLocale "vi"
  ${ElseIf} $1 == 4
    ${If} $0 == 3076
      StrCpy $OneKeyModernLocale "zh-HK"
    ${ElseIf} $0 == 1028
    ${OrIf} $0 == 5124
      StrCpy $OneKeyModernLocale "zh-TW"
    ${Else}
      StrCpy $OneKeyModernLocale "zh-CN"
    ${EndIf}
  ${EndIf}
!macroend

!ifdef BUILD_UNINSTALLER

  !define /redef APP_PRODUCT_FILENAME "OneKey Wallet"
  Var OneKeyModernUninstallAccepted
  Var OneKeyModernUninstallOriginalDirectory
  Var OneKeyModernUninstallRetryScope
  Var OneKeyModernUninstallRetryPath
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.OneKeyModernOnGuiInit
  Function un.OneKeyModernOnGuiInit
    ${IfNot} ${Silent}
    ${AndIf} $OneKeyModernUiActive == "1"
      ShowWindow $HWNDPARENT ${SW_HIDE}
    ${EndIf}
  FunctionEnd

  Function un.OneKeyModernUninstallWelcomePre
    ${If} $OneKeyModernUninstallAccepted == "1"
      Abort
    ${EndIf}
  FunctionEnd

  !macro customUnWelcomePage
    !define MUI_WELCOMEPAGE_TEXT "$(OneKeyUninstallWarning)"
    !define MUI_PAGE_CUSTOMFUNCTION_PRE un.OneKeyModernUninstallWelcomePre
    !insertmacro MUI_UNPAGE_WELCOME
  !macroend

  Function un.OneKeyModernUninstallInstFilesPre
    ${If} $OneKeyModernUiActive == "1"
      !insertmacro OneKeyModernRendererCall ConcealHost ''
      Pop $OneKeyModernResult
      ShowWindow $HWNDPARENT ${SW_HIDE}
    ${EndIf}
  FunctionEnd

  Function un.OneKeyModernUninstallInstFilesShow
    ${If} $OneKeyModernUiActive == "1"
      !insertmacro OneKeyModernRendererCall ConcealHost ''
      Pop $OneKeyModernResult
      ShowWindow $HWNDPARENT ${SW_HIDE}
    ${EndIf}
  FunctionEnd

  !macro customUninstallInstFilesPage
    !define MUI_PAGE_CUSTOMFUNCTION_PRE un.OneKeyModernUninstallInstFilesPre
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.OneKeyModernUninstallInstFilesShow
    !insertmacro MUI_UNPAGE_INSTFILES
  !macroend

  # The uninstaller path identifies the exact per-user or per-machine entry
  # launched by Windows, so the native scope page never needs to be displayed.
  !macro customInstallMode
    ${If} $OneKeyModernUninstallOriginalDirectory == $perMachineInstallationFolder
      StrCpy $isForceMachineInstall "1"
    ${ElseIf} $OneKeyModernUninstallOriginalDirectory == $perUserInstallationFolder
      StrCpy $isForceCurrentInstall "1"
    ${ElseIf} $hasPerUserInstallation == "1"
    ${AndIf} $hasPerMachineInstallation == "1"
      ${If} $OneKeyModernUiActive == "1"
        !insertmacro OneKeyModernRendererCall Shutdown ''
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
      ${EndIf}
      ShowWindow $HWNDPARENT ${SW_SHOW}
    ${EndIf}
  !macroend

  # This hook runs before initMultiUser can elevate a per-machine uninstall.
  # The modern confirmation therefore remains the first visible frame.
  !macro customUnPreInit
    StrCpy $OneKeyModernUninstallOriginalDirectory "$INSTDIR"
    StrCpy $OneKeyModernUiActive "0"
    StrCpy $OneKeyModernIsInner "0"
    StrCpy $OneKeyModernUninstallAccepted "0"
    ${If} ${UAC_IsInnerInstance}
      StrCpy $OneKeyModernIsInner "1"
      !insertmacro UAC_AsUser_GetGlobal $OneKeyModernUninstallAccepted $OneKeyModernUninstallAccepted
      !insertmacro UAC_AsUser_GetGlobal $OneKeyModernUninstallOriginalDirectory $OneKeyModernUninstallOriginalDirectory
    ${EndIf}
    !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
      !insertmacro OneKeyRecoveryGuardUninstall "$OneKeyModernUninstallOriginalDirectory"
    !endif

    ${IfNot} ${Silent}
    ${AndIf} $OneKeyModernUninstallAccepted == "1"
      # The elevated inner process owns a different native host. Conceal it and
      # recreate the modern progress page before initMultiUser can display it.
      !insertmacro OneKeyModernSelectLocale
      !insertmacro OneKeyModernRendererInit
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        !insertmacro OneKeyModernRendererCall SetPage '"uninstalling"'
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        !insertmacro OneKeyModernRendererCall Show ''
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        StrCpy $OneKeyModernUiActive "1"
        ShowWindow $HWNDPARENT ${SW_HIDE}
        Goto OneKeyModernUnPreInitDone
      ${EndIf}

      !insertmacro OneKeyModernRendererCall Shutdown ''
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
    ${ElseIfNot} ${Silent}
    ${AndIf} $OneKeyModernUninstallAccepted != "1"
      !insertmacro OneKeyModernSelectLocale
      !insertmacro OneKeyModernRendererInit
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        !insertmacro OneKeyModernRendererCall SetPage '"uninstallWelcome"'
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        !insertmacro OneKeyModernRendererCall Show ''
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        StrCpy $OneKeyModernUiActive "1"
        ShowWindow $HWNDPARENT ${SW_HIDE}
        !insertmacro OneKeyModernRendererCall WaitForEvent ''
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult == "primary"
          StrCpy $OneKeyModernUninstallAccepted "1"
          !insertmacro OneKeyModernRendererCall SetPage '"uninstalling"'
          Pop $OneKeyModernResult
          ${If} $OneKeyModernResult == "ok"
            !insertmacro OneKeyModernRendererCall Show ''
            Pop $OneKeyModernResult
          ${EndIf}
          ${If} $OneKeyModernResult == "ok"
            ShowWindow $HWNDPARENT ${SW_HIDE}
            Goto OneKeyModernUnPreInitDone
          ${EndIf}
        ${Else}
          !insertmacro OneKeyModernRendererCall ShutdownHidden ''
          Pop $0
          StrCpy $OneKeyModernUiActive "0"
          Quit
        ${EndIf}
      ${EndIf}

      !insertmacro OneKeyModernRendererCall Shutdown ''
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
    ${EndIf}

  OneKeyModernUnPreInitDone:
  !macroend

  !macro customUnInit
    ${IfNot} ${Silent}
    ${AndIf} $OneKeyModernUninstallAccepted == "1"
      ${If} $OneKeyModernUiActive != "1"
        !insertmacro OneKeyModernSelectLocale
        !insertmacro OneKeyModernRendererInit
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult == "ok"
          StrCpy $OneKeyModernUiActive "1"
        ${EndIf}
      ${Else}
        StrCpy $OneKeyModernResult "ok"
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        !insertmacro OneKeyModernRendererCall SetPage '"uninstalling"'
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        !insertmacro OneKeyModernRendererCall Show ''
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        StrCpy $OneKeyModernUiActive "1"
        ShowWindow $HWNDPARENT ${SW_HIDE}
      ${Else}
        !insertmacro OneKeyModernRendererCall Shutdown ''
        Pop $0
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${EndIf}
    ${EndIf}
  !macroend

  !macro customUnInstallBeforeValidation
    GetFullPathName $OneKeyModernUninstallRetryPath "$OneKeyModernUninstallOriginalDirectory\${UNINSTALL_FILENAME}"
    ${If} $installMode == "all"
      StrCpy $OneKeyModernUninstallRetryScope "/allusers"
    ${Else}
      StrCpy $OneKeyModernUninstallRetryScope "/currentuser"
    ${EndIf}
  !macroend

  !macro customUnInstall
    ${If} $OneKeyModernUiActive == "1"
      !insertmacro OneKeyModernRendererCall SetPage '"uninstalling"'
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
      OneKeyModernUninstallPrepareCommit:
        !insertmacro OneKeyModernRendererCall PrepareCommit ''
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult == "pending"
          Sleep 80
          Goto OneKeyModernUninstallPrepareCommit
        ${ElseIf} $OneKeyModernResult == "cancel"
          !insertmacro OneKeyModernRendererCall ShutdownHidden ''
          Pop $0
          StrCpy $OneKeyModernUiActive "0"
          SetErrorLevel 1
          Quit
        ${EndIf}
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        !insertmacro OneKeyModernRendererCall Show ''
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult != "ok"
        !insertmacro OneKeyModernRendererCall Shutdown ''
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${Else}
        ShowWindow $HWNDPARENT ${SW_HIDE}
      ${EndIf}
    ${EndIf}
  !macroend

  !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
    !macro OneKeyUninstallCheckOtherScope FLAGS
      IntOp $3 ${NSIS_MAX_STRLEN} * 2
      System::Call 'Advapi32::RegGetValueW(p r7, w "${INSTALL_REGISTRY_KEY}", w "InstallLocation", i ${FLAGS}, p 0, w .r1, *i r3)i .r2'
      ${If} $2 == 0
        GetFullPathName $1 "$1"
        StrCmp $1 "" OneKeyUninstallInvalidTarget
        StrCpy $1 "$1\"
        StrCpy $2 "$0\"
        StrLen $3 "$1"
        StrCpy $4 "$2" $3
        StrCmp $1 $4 OneKeyUninstallInvalidTarget
        StrLen $3 "$2"
        StrCpy $4 "$1" $3
        StrCmp $2 $4 OneKeyUninstallInvalidTarget
      ${ElseIf} $2 != 2
      ${AndIf} $2 != 3
        Goto OneKeyUninstallInvalidTarget
      ${EndIf}
    !macroend

    !macro customValidateUninstallTarget
      ${If} $installMode == "all"
        !insertmacro OneKeyRecoveryGuardInitiatingUser
      ${EndIf}
      !insertmacro OneKeyRecoveryGuardUninstall "$OneKeyModernUninstallOriginalDirectory"

      # Confirm the selected scope and launch directory before closing a process
      # or modifying its installation. Do not follow a reparse point to a target.
      ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" InstallLocation
      StrCmp $0 "" OneKeyUninstallInvalidTarget
      GetFullPathName $0 "$0"
      GetFullPathName $1 "$OneKeyModernUninstallOriginalDirectory"
      GetFullPathName $2 "$INSTDIR"
      StrCmp $0 "" OneKeyUninstallInvalidTarget
      StrCmp $0 $1 0 OneKeyUninstallInvalidTarget
      StrCmp $0 $2 0 OneKeyUninstallInvalidTarget
      ${If} $installMode == "all"
        StrCpy $7 0x80000001
      ${Else}
        StrCpy $7 0x80000002
      ${EndIf}
      !insertmacro OneKeyUninstallCheckOtherScope 0x00010002
      !insertmacro OneKeyUninstallCheckOtherScope 0x00020002
      OneKeyUninstallCheckAncestor:
        System::Call 'Kernel32::GetFileAttributesW(w r0)i .r1'
        IntOp $1 $1 & 0x410
        StrCmp $1 16 0 OneKeyUninstallInvalidDirectory
        ${GetParent} "$0" $1
        StrCmp $1 "" OneKeyUninstallValidTarget
        StrCpy $2 "$1" 1 -1
        ${If} $2 == ":"
          System::Call 'Kernel32::GetFileAttributesW(w "$1\")i .r1'
          IntOp $1 $1 & 0x410
          StrCmp $1 16 OneKeyUninstallValidTarget OneKeyUninstallInvalidDirectory
        ${EndIf}
        StrCpy $0 "$1"
        Goto OneKeyUninstallCheckAncestor

      OneKeyUninstallInvalidDirectory:
        !insertmacro OneKeyRecoveryReportPathError ${ONEKEY_RECOVERY_UNSUPPORTED_LOCATION}
        SetErrorLevel 1
        Quit

      OneKeyUninstallInvalidTarget:
        ${IfNot} ${Silent}
          MessageBox MB_OK|MB_ICONSTOP "To uninstall OneKey, open Installed apps in Windows Settings."
        ${EndIf}
        SetErrorLevel 1
        Quit

      OneKeyUninstallValidTarget:
        ClearErrors
    !macroend
  !endif

  !macro customUnInstallFilesRemoved
    DeleteRegKey SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}"
    !insertmacro OneKeyUnregisterProtocolSchemes
    ${If} $installMode == "all"
    ${AndIf} ${UAC_IsInnerInstance}
      !insertmacro UAC_AsUser_Call Function un.OneKeyUnregisterUserProtocols 0
    ${EndIf}
  !macroend

  !macro customHeader
    !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
      !insertmacro OneKeyRecoveryDefineOuterState
    !endif
    !tempfile ONEKEY_UNINSTALL_MESSAGES
    !system 'node "${PROJECT_DIR}/scripts/generate-nsis-uninstall-messages.js" "${ONEKEY_UNINSTALL_MESSAGES}"' = 0
    !include /CHARSET=UTF8 "${ONEKEY_UNINSTALL_MESSAGES}"
    !delfile "${ONEKEY_UNINSTALL_MESSAGES}"
    !undef ONEKEY_UNINSTALL_MESSAGES

    Function un.OneKeyUnregisterUserProtocols
      SetShellVarContext current
      !insertmacro OneKeyUnregisterProtocolIfOwned HKCU "onekey-wallet"
      !insertmacro OneKeyUnregisterProtocolIfOwned HKCU "wc"
      !insertmacro OneKeyUnregisterProtocolIfOwned HKCU "ethereum"
      ClearErrors
      ${If} $installMode == "all"
        SetShellVarContext all
      ${EndIf}
    FunctionEnd

    Function un.OneKeyRemoveAppData
      Call un.OneKeyUnregisterUserProtocols
      SetShellVarContext current
      RMDir /r "$APPDATA\${APP_FILENAME}"
      !ifdef APP_PRODUCT_FILENAME
        RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
      !endif
      !ifdef APP_PACKAGE_NAME
        RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
      !endif
      ${If} $installMode == "all"
        SetShellVarContext all
      ${EndIf}
    FunctionEnd
    !insertmacro OneKeyModernDefineUninstallRetry
  !macroend

  !macro customRemoveAppData
    ${If} $installMode == "all"
    ${AndIf} ${UAC_IsInnerInstance}
      !insertmacro UAC_AsUser_Call Function un.OneKeyRemoveAppData 0
    ${Else}
      Call un.OneKeyRemoveAppData
    ${EndIf}
  !macroend

  !macro customUninstallPage
    UninstPage custom un.OneKeyModernUninstallFinish
  !macroend

  Function un.OneKeyModernUninstallFinish
    ${If} $OneKeyModernUiActive != "1"
      Abort
    ${EndIf}

    !insertmacro OneKeyModernRendererCall SetProgress '"100"'
    Pop $OneKeyModernResult
    !insertmacro OneKeyModernRendererCall SetPage '"uninstallFinish"'
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult != "ok"
      !insertmacro OneKeyModernRendererCall Shutdown ''
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}

    ShowWindow $HWNDPARENT ${SW_HIDE}
    !insertmacro OneKeyModernRendererCall WaitForEvent ''
    Pop $OneKeyModernResult
    !insertmacro OneKeyModernRendererCall Shutdown ''
    Pop $0
    Quit
  FunctionEnd

  Function un.OneKeyModernCheckUninstallRetryRegistration
    ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${If} $0 != ""
      GetFullPathName $0 "$0"
      GetFullPathName $1 "$OneKeyModernUninstallOriginalDirectory"
      ${If} $0 == $1
        ReadRegStr $0 SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" UninstallString
        ${If} $0 == '"$OneKeyModernUninstallRetryPath" $OneKeyModernUninstallRetryScope'
          StrCpy $0 "ok"
          Return
        ${EndIf}
      ${EndIf}
    ${EndIf}
    StrCpy $0 "error"
  FunctionEnd

  !macro OneKeyModernDefineUninstallRetry
    !ifdef ONEKEY_USE_WIN32_INSTALLER_UI
      Function un.OneKeyModernRetryAsInitiatingUser
        # The UAC callback executes in the original account and synchronizes $0-$9.
        onekey-installer-ui::RetryUninstall "$0" "$1"
        Pop $2
      FunctionEnd
    !endif

    Function un.OneKeyModernRetryUninstall
      StrCpy $OneKeyModernResult "error"
      !ifdef ONEKEY_USE_WIN32_INSTALLER_UI
        ${If} ${UAC_IsInnerInstance}
          StrCpy $0 "$OneKeyModernUninstallRetryPath"
          StrCpy $1 "$OneKeyModernUninstallRetryScope"
          StrCpy $2 "error"
          ClearErrors
          !insertmacro UAC_AsUser_Call Function un.OneKeyModernRetryAsInitiatingUser ${UAC_SYNCREGISTERS}
          ${IfNot} ${Errors}
            StrCpy $OneKeyModernResult "$2"
          ${EndIf}
        ${Else}
          !insertmacro OneKeyModernRendererCall RetryUninstall '"$OneKeyModernUninstallRetryPath" "$OneKeyModernUninstallRetryScope"'
          Pop $OneKeyModernResult
        ${EndIf}
      !endif
    FunctionEnd
  !macroend

  Function un.OneKeyModernShowUninstallFailure
    ${If} $OneKeyModernUiActive == "1"
      !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
        ${If} $OneKeyUninstallPathErrorReported == "1"
          Goto OneKeyModernUninstallExit
        ${EndIf}
        ${If} $OneKeyUninstallCommitted == "1"
          Goto OneKeyModernUninstallNeedsSetup
        ${EndIf}
      !endif
      Call un.OneKeyModernCheckUninstallRetryRegistration
      ${If} $0 != "ok"
        Goto OneKeyModernUninstallNeedsSetup
      ${EndIf}
      !insertmacro OneKeyModernRendererCall CheckUninstallRetry '"$OneKeyModernUninstallRetryPath" "$OneKeyModernUninstallRetryScope"'
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult != "ok"
        Goto OneKeyModernUninstallNeedsSetup
      ${EndIf}
      !insertmacro OneKeyModernRendererCall SetPage '"uninstallError"'
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        !insertmacro OneKeyModernRendererCall Show ''
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        ShowWindow $HWNDPARENT ${SW_HIDE}
        !insertmacro OneKeyModernRendererCall WaitForEvent ''
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult == "primary"
          Call un.OneKeyModernCheckUninstallRetryRegistration
          ${If} $0 != "ok"
            Goto OneKeyModernUninstallNeedsSetup
          ${EndIf}
          Call un.OneKeyModernRetryUninstall
          ${If} $OneKeyModernResult != "ok"
            Goto OneKeyModernUninstallNeedsSetup
          ${EndIf}
        ${EndIf}
        Goto OneKeyModernUninstallExit
      ${Else}
        !insertmacro OneKeyModernRendererCall Shutdown ''
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${EndIf}
    ${EndIf}
    Return

    OneKeyModernUninstallNeedsSetup:
      !insertmacro OneKeyInstallerMessage MB_OK|MB_ICONINFORMATION|MB_SETFOREGROUND \
        "OneKey could not finish uninstalling. Run OneKey Setup to recover the installation." \
        "OneKey 未能完成卸载。请运行 OneKey 安装程序以恢复安装。"

    OneKeyModernUninstallExit:
      !insertmacro OneKeyModernRendererCall ShutdownHidden ''
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      SetErrorLevel 1
      Quit
  FunctionEnd

  Function un.onUninstFailed
    Call un.OneKeyModernShowUninstallFailure
  FunctionEnd

!else

  !macro customWelcomePage
    !insertmacro OneKeyModernWelcomeFunction
    Page custom OneKeyModernWelcomeStart
  !macroend

  # One modern page owns the fresh-install decision. Quick install defaults to
  # the current user; advanced scope and directory choices expand in place.
  !macro OneKeyModernWelcomeFunction
  Function OneKeyModernWelcomeStart
    ${If} ${Silent}
    ${OrIf} $OneKeyModernDisabled == "1"
      Abort
    ${EndIf}
    ${If} $OneKeyModernIsInner == "1"
      Abort
    ${EndIf}
    !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
      ${If} $OneKeyModernRecoveryScope != ""
        Abort
      ${EndIf}
    !endif
    ${If} $OneKeyModernExplicitScope != ""
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}
    ${If} $OneKeyModernWasInstalled == "1"
    ${AndIf} $OneKeyModernHadPerUser != $OneKeyModernHadPerMachine
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}

    !insertmacro OneKeyModernSelectLocale
    !insertmacro OneKeyModernRendererInit
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "ok"
      ${If} $OneKeyModernWasInstalled == "1"
        !insertmacro OneKeyModernRendererCall SetPage '"upgradeScope"'
      ${Else}
        !insertmacro OneKeyModernRendererCall SetPage '"welcome"'
      ${EndIf}
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      !insertmacro OneKeyModernRendererCall SetPerUserInstallDirectory '"$OneKeyModernPerUserDirectory"'
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      !insertmacro OneKeyModernRendererCall SetPerMachineInstallDirectory '"$OneKeyModernPerMachineDirectory"'
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      !insertmacro OneKeyModernRendererCall Show ''
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      StrCpy $OneKeyModernUiActive "1"
      ShowWindow $HWNDPARENT ${SW_HIDE}
    ${Else}
      !insertmacro OneKeyModernRendererCall Shutdown ''
      Pop $0
      StrCpy $OneKeyModernDisabled "1"
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}

  OneKeyModernWelcomeLoop:
    !insertmacro OneKeyModernRendererCall WaitForEvent ''
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "terms"
    ${OrIf} $OneKeyModernResult == "privacy"
      !insertmacro OneKeyModernRendererCall OpenLegalLink '"$OneKeyModernResult"'
      Pop $0
      ${If} $0 != "ok"
        !insertmacro OneKeyInstallerMessage MB_OK|MB_ICONINFORMATION|MB_SETFOREGROUND \
          "Open this address in your browser.$\r$\n$0" \
          "请在浏览器中打开此地址。$\r$\n$0"
      ${EndIf}
      Goto OneKeyModernWelcomeLoop
    ${ElseIf} $OneKeyModernResult == "browse-current"
      ${If} $OneKeyModernWasInstalled == "1"
        Goto OneKeyModernWelcomeLoop
      ${EndIf}
      ClearErrors
      nsDialogs::SelectFolderDialog "$(^DirText)" "$OneKeyModernPerUserDirectory"
      Pop $0
      ${IfNot} ${Errors}
      ${AndIf} $0 != ""
      ${AndIf} $0 != "error"
        StrCpy $2 "$0" 1 -1
        ${If} $2 == "\"
          StrLen $1 "$0"
          ${If} $1 > 3
            StrCpy $0 "$0" -1
          ${EndIf}
        ${EndIf}
        StrLen $1 "${APP_FILENAME}"
        IntOp $1 $1 + 1
        StrCpy $2 "$0" $1 -$1
        ${If} $2 != "\${APP_FILENAME}"
          StrCpy $2 "$0" 1 -1
          ${If} $2 == "\"
            StrCpy $0 "$0${APP_FILENAME}"
          ${Else}
            StrCpy $0 "$0\${APP_FILENAME}"
          ${EndIf}
        ${EndIf}
        StrCpy $OneKeyModernPerUserDirectory "$0"
        !insertmacro OneKeyModernRendererCall SetPerUserInstallDirectory '"$0"'
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult != "ok"
          Goto OneKeyModernWelcomeFallback
        ${EndIf}
      ${EndIf}
      !insertmacro OneKeyModernRendererCall Show ''
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult != "ok"
        Goto OneKeyModernWelcomeFallback
      ${EndIf}
      ShowWindow $HWNDPARENT ${SW_HIDE}
      Goto OneKeyModernWelcomeLoop
    ${ElseIf} $OneKeyModernResult == "browse-all"
      ${If} $OneKeyModernWasInstalled == "1"
        Goto OneKeyModernWelcomeLoop
      ${EndIf}
      ClearErrors
      nsDialogs::SelectFolderDialog "$(^DirText)" "$OneKeyModernPerMachineDirectory"
      Pop $0
      ${IfNot} ${Errors}
      ${AndIf} $0 != ""
      ${AndIf} $0 != "error"
        StrCpy $2 "$0" 1 -1
        ${If} $2 == "\"
          StrLen $1 "$0"
          ${If} $1 > 3
            StrCpy $0 "$0" -1
          ${EndIf}
        ${EndIf}
        StrLen $1 "${APP_FILENAME}"
        IntOp $1 $1 + 1
        StrCpy $2 "$0" $1 -$1
        ${If} $2 != "\${APP_FILENAME}"
          StrCpy $2 "$0" 1 -1
          ${If} $2 == "\"
            StrCpy $0 "$0${APP_FILENAME}"
          ${Else}
            StrCpy $0 "$0\${APP_FILENAME}"
          ${EndIf}
        ${EndIf}
        StrCpy $OneKeyModernPerMachineDirectory "$0"
        !insertmacro OneKeyModernRendererCall SetPerMachineInstallDirectory '"$0"'
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult != "ok"
          Goto OneKeyModernWelcomeFallback
        ${EndIf}
      ${EndIf}
      !insertmacro OneKeyModernRendererCall Show ''
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult != "ok"
        Goto OneKeyModernWelcomeFallback
      ${EndIf}
      ShowWindow $HWNDPARENT ${SW_HIDE}
      Goto OneKeyModernWelcomeLoop
    ${ElseIf} $OneKeyModernResult == "primary-current"
    ${OrIf} $OneKeyModernResult == "scope-current"
      StrCpy $OneKeyModernInstallScope "current"
      ${If} $OneKeyModernWasInstalled == "0"
        StrCpy $OneKeyModernAccepted "1"
        StrCpy $OneKeyModernChosenDirectory "$OneKeyModernPerUserDirectory"
      ${EndIf}
      Goto OneKeyModernWelcomeProceed
    ${ElseIf} $OneKeyModernResult == "primary-all"
    ${OrIf} $OneKeyModernResult == "scope-all"
      StrCpy $OneKeyModernInstallScope "all"
      ${If} $OneKeyModernWasInstalled == "0"
        StrCpy $OneKeyModernAccepted "1"
        StrCpy $OneKeyModernChosenDirectory "$OneKeyModernPerMachineDirectory"
      ${EndIf}

      ${If} $OneKeyModernIsAdmin != "1"
        !insertmacro OneKeyModernRendererCall Hide ''
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult != "ok"
          Goto OneKeyModernWelcomeFallback
        ${EndIf}
        !insertmacro UAC_RunElevated
        ${If} $0 == 0
        ${AndIf} $1 == 1
          Quit
        ${EndIf}
        ${If} $0 == 0
        ${AndIf} $3 != 0
          Goto OneKeyModernWelcomeProceed
        ${EndIf}
        !insertmacro OneKeyModernRendererCall Show ''
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult != "ok"
          Goto OneKeyModernWelcomeFallback
        ${EndIf}
        ShowWindow $HWNDPARENT ${SW_HIDE}
        Goto OneKeyModernWelcomeLoop
      ${EndIf}
      Goto OneKeyModernWelcomeProceed
    ${Else}
      !insertmacro OneKeyModernRendererCall ShutdownHidden ''
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      Quit
    ${EndIf}

  OneKeyModernWelcomeProceed:
    ${If} $OneKeyModernWasInstalled == "0"
      !insertmacro OneKeyModernRendererCall SetPage '"installing"'
    ${Else}
      !insertmacro OneKeyModernRendererCall SetPage '"upgrade"'
    ${EndIf}
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "ok"
    ${AndIf} $OneKeyModernWasInstalled == "0"
      !insertmacro OneKeyModernRendererCall ResetProgress '"0"'
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      !insertmacro OneKeyModernRendererCall Show ''
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult != "ok"
      Goto OneKeyModernWelcomeFallback
    ${EndIf}
    StrCpy $OneKeyModernUiActive "1"
    ShowWindow $HWNDPARENT ${SW_HIDE}
    Abort

  OneKeyModernWelcomeFallback:
    !insertmacro OneKeyModernRendererCall Shutdown ''
    Pop $0
    StrCpy $OneKeyModernUiActive "0"
    StrCpy $OneKeyModernDisabled "1"
    ShowWindow $HWNDPARENT ${SW_SHOW}
    Abort
  FunctionEnd
  !macroend

  !macro customPageAfterChangeDir
    Page custom OneKeyModernInstallStart
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW OneKeyModernOnInstFilesShow
  !macroend

  # Run the modern finish UI only after the installation section has returned.
  # Keep the native MUI finish page behind it for initialization fallbacks.
  !macro customFinishPage
    Function OneKeyModernStartApp
      !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
        ${If} $OneKeyRecoveryReadyToLaunch != "1"
          StrCpy $0 "error"
          Return
        ${EndIf}
      !endif
      ${If} ${isUpdated}
        StrCpy $OneKeyModernStartAppArgs "--updated"
      ${Else}
        StrCpy $OneKeyModernStartAppArgs ""
      ${EndIf}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$OneKeyModernStartAppArgs"
      ${If} $0 != "ok"
      ${AndIf} $0 != "fallback"
        ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "open" "$OneKeyModernStartAppArgs"
      ${EndIf}
    FunctionEnd

    Page custom OneKeyModernInstallFinish
    !ifndef HIDE_RUN_AFTER_FINISH
      !define MUI_FINISHPAGE_RUN
      !define MUI_FINISHPAGE_RUN_FUNCTION "OneKeyModernStartApp"
    !endif
    !insertmacro MUI_PAGE_FINISH
  !macroend

  # This page runs after the hidden install-mode page. The selected fresh-install
  # path is written back here so stale registry values cannot override the
  # scope and location already shown to the user.
  Function OneKeyModernInstallStart
    ${If} ${Silent}
    ${OrIf} $OneKeyModernDisabled == "1"
      Abort
    ${EndIf}

    ${If} $OneKeyModernAccepted == "1"
    ${AndIf} $OneKeyModernChosenDirectory != ""
      StrCpy $INSTDIR "$OneKeyModernChosenDirectory"
    ${EndIf}

    ${If} $OneKeyModernUiActive == "1"
      !insertmacro OneKeyModernRendererCall ConcealHost ''
      Pop $OneKeyModernResult
    ${Else}
      !insertmacro OneKeyModernSelectLocale
      !insertmacro OneKeyModernRendererInit
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        ${If} $OneKeyModernAccepted == "1"
          !insertmacro OneKeyModernRendererCall SetPage '"installing"'
        ${Else}
          !insertmacro OneKeyModernRendererCall SetPage '"upgrade"'
        ${EndIf}
        Pop $OneKeyModernResult
      ${EndIf}
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      !insertmacro OneKeyModernRendererCall SetInstallDirectory '"$INSTDIR"'
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      !insertmacro OneKeyModernRendererCall Show ''
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      StrCpy $OneKeyModernUiActive "1"
      ShowWindow $HWNDPARENT ${SW_HIDE}
    ${Else}
      Goto OneKeyModernInstallFallback
    ${EndIf}

    # ResetProgress resumes the plug-in's native progress mirror. During
    # InstFiles, its timer also forwards confirmed Cancel/Close as IDCANCEL.
    ${If} $OneKeyModernAccepted == "1"
      !insertmacro OneKeyModernRendererCall ResetProgress '"0"'
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        Abort
      ${EndIf}
      Goto OneKeyModernInstallFallback
    ${EndIf}

    !insertmacro OneKeyModernRendererCall WaitForEvent ''
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "primary"
      !insertmacro OneKeyModernRendererCall ResetProgress '"0"'
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        !insertmacro OneKeyModernRendererCall SetPage '"installing"'
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        Abort
      ${EndIf}
      Goto OneKeyModernInstallFallback
    ${Else}
      !insertmacro OneKeyModernRendererCall ShutdownHidden ''
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      Quit
    ${EndIf}

  OneKeyModernInstallFallback:
    !insertmacro OneKeyModernRendererCall Shutdown ''
    Pop $0
    StrCpy $OneKeyModernUiActive "0"
    StrCpy $OneKeyModernDisabled "1"
    ShowWindow $HWNDPARENT ${SW_SHOW}
    Abort
  FunctionEnd

  # Embedded 7z extraction is cancellable because it only writes temporary
  # files. Lock cancellation before old-version removal and the final copy.
  !macro customInstallBeforeRemoveOldVersion
    !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
      ${If} $OneKeyRecoveryState != "published"
    !endif
      # Web, directory, and ZIP packages follow the builder extraction paths.
      !ifndef APP_BUILD_DIR
        !ifndef APP_PACKAGE_URL
          !ifndef ZIP_COMPRESSION
            ClearErrors
            !ifdef COMPRESS
              SetCompress off
            !endif
            !ifdef APP_32
              StrCpy $OneKeyModernPackageArch "32"
            !endif
            !ifdef APP_64
              ${If} ${RunningX64}
              ${OrIf} ${IsNativeARM64}
                StrCpy $OneKeyModernPackageArch "64"
              ${EndIf}
            !endif
            !ifdef APP_ARM64
              ${If} ${IsNativeARM64}
                StrCpy $OneKeyModernPackageArch "arm64"
              ${EndIf}
            !endif
            ${If} $OneKeyModernPackageArch == "arm64"
              !ifdef APP_ARM64
                !insertmacro arm64_app_files
              !endif
            ${ElseIf} $OneKeyModernPackageArch == "64"
              !ifdef APP_64
                !insertmacro x64_app_files
              !endif
            ${Else}
              !ifdef APP_32
                !insertmacro ia32_app_files
              !endif
            ${EndIf}
            File /oname=$PLUGINSDIR\onekey-7za.exe "${ONEKEY_7ZA_WINDOWS_IA32}"
            !ifdef COMPRESS
              SetCompress "${COMPRESS}"
            !endif

            CreateDirectory "$PLUGINSDIR\7z-out"
            ${IfNot} ${Errors}
              # Nsis7z ignores extraction failures. The 7za exit code catches
              # archive and write failures before old-version removal.
              nsExec::ExecToStack '"$PLUGINSDIR\onekey-7za.exe" x -y -o"$PLUGINSDIR\7z-out" "$PLUGINSDIR\app-$OneKeyModernPackageArch.7z"'
              Pop $OneKeyModernResult
              Pop $0
              ${If} $OneKeyModernResult == "0"
                StrCpy $OneKeyModernPackagePrepared "1"
              ${EndIf}
            ${EndIf}
            ${If} $OneKeyModernPackagePrepared != "1"
              DetailPrint "OneKey Setup could not prepare the embedded application package."
              SetErrorLevel 1
              Call OneKeyModernShowInstallFailure
              Abort
            ${EndIf}
          !endif
        !endif
      !endif
    !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
      ${EndIf}
    !endif

    ${If} $OneKeyModernUiActive == "1"
    OneKeyModernPrepareCommit:
      !insertmacro OneKeyModernRendererCall PrepareCommit ''
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "pending"
        Sleep 80
        Goto OneKeyModernPrepareCommit
      ${ElseIf} $OneKeyModernResult == "cancel"
        !insertmacro OneKeyModernRendererCall ShutdownHidden ''
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        SetErrorLevel 1
        Quit
      ${ElseIf} $OneKeyModernResult != "ok"
        !insertmacro OneKeyModernRendererCall Shutdown ''
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
        Abort
      ${EndIf}
    ${EndIf}
  !macroend

  !macro customEmbedAppPackage
    ${If} $OneKeyModernPackagePrepared != "1"
      !insertmacro compute_files_for_current_arch
    ${EndIf}
  !macroend

  !macro customPrepareAppPackage ARCHIVE
    ${If} $OneKeyModernPackagePrepared != "1"
      Nsis7z::Extract "${ARCHIVE}"
    ${EndIf}
  !macroend

  !macro customInstall
    !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
      ${if} ${FileExists} "$newStartMenuLink"
        ClearErrors
        WinShell::SetLnkAUMI "$newStartMenuLink" "${ONEKEY_APP_USER_MODEL_ID}"
        !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
          !insertmacro OneKeyRecoveryCheckErrors
        !endif
      ${endIf}
    !endif

    ClearErrors
    WriteRegExpandStr SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegExpandStr SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}" "IconUri" "$INSTDIR\resources\windows\notificationIcon.png"
    !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
      !insertmacro OneKeyRecoveryCheckErrors
    !endif
    !insertmacro OneKeyRegisterProtocolScheme "onekey-wallet" "URL:OneKey Protocol"
    !insertmacro OneKeyRegisterProtocolScheme "wc" "URL:WalletConnect Protocol"
    !insertmacro OneKeyRegisterProtocolScheme "ethereum" "URL:Ethereum Protocol"

    !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
      !insertmacro OneKeyRecoveryFinish
    !endif
    ${If} $OneKeyModernUiActive == "1"
      # Native mirroring has already reported intermediate progress.
      !insertmacro OneKeyModernRendererCall SetProgress '"100"'
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult != "ok"
        !insertmacro OneKeyModernRendererCall Shutdown ''
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${EndIf}
    ${EndIf}
  !macroend

  Function OneKeyModernInstallFinish
    !ifdef ONEKEY_USE_DIRECTORY_RECOVERY
      ${If} $OneKeyRecoveryReadyToLaunch != "1"
        Abort
      ${EndIf}
    !endif
    ${If} $OneKeyModernUiActive != "1"
      Abort
    ${EndIf}

    !insertmacro OneKeyModernRendererCall SetPage '"finish"'
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult != "ok"
      !insertmacro OneKeyModernRendererCall Shutdown ''
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}

  OneKeyModernFinishWait:
    ShowWindow $HWNDPARENT ${SW_HIDE}
    !insertmacro OneKeyModernRendererCall WaitForEvent ''
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "primary"
      Call OneKeyModernStartApp
      ${If} $0 != "ok"
      ${AndIf} $0 != "fallback"
        !insertmacro OneKeyModernRendererCall SetPage '"finish"'
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult == "ok"
          !insertmacro OneKeyModernRendererCall Show ''
          Pop $OneKeyModernResult
        ${EndIf}
        ${If} $OneKeyModernResult == "ok"
          Goto OneKeyModernFinishWait
        ${EndIf}
        Goto OneKeyModernFinishFallback
      ${EndIf}
    ${EndIf}

    !insertmacro OneKeyModernRendererCall Shutdown ''
    Pop $0
    StrCpy $OneKeyModernUiActive "0"
    SetErrorLevel 0
    Quit

  OneKeyModernFinishFallback:
    !insertmacro OneKeyModernRendererCall Shutdown ''
    Pop $0
    StrCpy $OneKeyModernUiActive "0"
    ShowWindow $HWNDPARENT ${SW_SHOW}
    Abort
  FunctionEnd

  Function OneKeyModernShowInstallFailure
    ${If} $OneKeyModernUiActive == "1"
      !insertmacro OneKeyModernRendererCall SetPage '"error"'
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        !insertmacro OneKeyModernRendererCall Show ''
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        ShowWindow $HWNDPARENT ${SW_HIDE}
        !insertmacro OneKeyModernRendererCall WaitForEvent ''
        Pop $OneKeyModernResult
        !insertmacro OneKeyModernRendererCall Shutdown ''
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ${If} $OneKeyModernResult == "primary"
          ExecShell "open" "$EXEPATH"
        ${EndIf}
        SetErrorLevel 1
        Quit
      ${Else}
        !insertmacro OneKeyModernRendererCall Shutdown ''
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${EndIf}
    ${EndIf}
  FunctionEnd

  Function .onInstFailed
    Call OneKeyModernShowInstallFailure
  FunctionEnd

!endif
