# OneKey modern installer UI. The native NSIS window remains untouched until
# the plugin and the complete theme package have both initialized successfully.

!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "nsDialogs.nsh"
!addplugindir /x86-unicode "${BUILD_RESOURCES_DIR}\nsis-duilib-ui\plugin\x86-unicode"

Var OneKeyModernUiActive
Var OneKeyModernLocale
Var OneKeyModernResult
Var OneKeyModernIsInner

!ifndef BUILD_UNINSTALLER
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

  ${If} $OneKeyModernPerUserDirectory != ""
  ${AndIf} ${FileExists} "$OneKeyModernPerUserDirectory\${UNINSTALL_FILENAME}"
    StrCpy $OneKeyModernHadPerUser "1"
    StrCpy $OneKeyModernWasInstalled "1"
  ${Else}
    StrCpy $OneKeyModernPerUserDirectory ""
  ${EndIf}
  ${If} $OneKeyModernPerMachineDirectory != ""
  ${AndIf} ${FileExists} "$OneKeyModernPerMachineDirectory\${UNINSTALL_FILENAME}"
    StrCpy $OneKeyModernHadPerMachine "1"
    StrCpy $OneKeyModernWasInstalled "1"
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
    StrCpy $OneKeyModernExplicitScope "current"
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
    !ifdef APP_64
      ${If} ${RunningX64}
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

!macro OneKeyModernExtractTheme
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\onekey-modern"
  File /r "${BUILD_RESOURCES_DIR}\nsis-duilib-ui\onekey-modern\*.*"
  SetOutPath "$PLUGINSDIR\onekey-modern\licenses"
  File /r "${BUILD_RESOURCES_DIR}\nsis-duilib-ui\licenses\*.*"
!macroend

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

  Var OneKeyModernUninstallAccepted
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
    !define MUI_PAGE_CUSTOMFUNCTION_PRE un.OneKeyModernUninstallWelcomePre
    !insertmacro MUI_UNPAGE_WELCOME
  !macroend

  Function un.OneKeyModernUninstallInstFilesPre
    ${If} $OneKeyModernUiActive == "1"
      nsis-duilib-ui::ConcealHost
      Pop $OneKeyModernResult
      ShowWindow $HWNDPARENT ${SW_HIDE}
    ${EndIf}
  FunctionEnd

  Function un.OneKeyModernUninstallInstFilesShow
    ${If} $OneKeyModernUiActive == "1"
      nsis-duilib-ui::ConcealHost
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
    ${If} $INSTDIR == $perMachineInstallationFolder
      StrCpy $isForceMachineInstall "1"
    ${ElseIf} $INSTDIR == $perUserInstallationFolder
      StrCpy $isForceCurrentInstall "1"
    ${ElseIf} $hasPerUserInstallation == "1"
    ${AndIf} $hasPerMachineInstallation == "1"
      ${If} $OneKeyModernUiActive == "1"
        nsis-duilib-ui::Shutdown
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
      ${EndIf}
      ShowWindow $HWNDPARENT ${SW_SHOW}
    ${EndIf}
  !macroend

  # This hook runs before initMultiUser can elevate a per-machine uninstall.
  # The modern confirmation therefore remains the first visible frame.
  !macro customUnPreInit
    StrCpy $OneKeyModernUiActive "0"
    StrCpy $OneKeyModernIsInner "0"
    StrCpy $OneKeyModernUninstallAccepted "0"
    ${If} ${UAC_IsInnerInstance}
      StrCpy $OneKeyModernIsInner "1"
      !insertmacro UAC_AsUser_GetGlobal $OneKeyModernUninstallAccepted $OneKeyModernUninstallAccepted
    ${EndIf}

    ${IfNot} ${Silent}
    ${AndIf} $OneKeyModernUninstallAccepted == "1"
      # The elevated inner process owns a different native host. Conceal it and
      # recreate the modern progress page before initMultiUser can display it.
      !insertmacro OneKeyModernExtractTheme
      !insertmacro OneKeyModernSelectLocale
      nsis-duilib-ui::Init "$PLUGINSDIR\onekey-modern" "$OneKeyModernLocale" "${VERSION}"
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        nsis-duilib-ui::SetPage "uninstalling"
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        nsis-duilib-ui::Show
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        StrCpy $OneKeyModernUiActive "1"
        ShowWindow $HWNDPARENT ${SW_HIDE}
        Goto OneKeyModernUnPreInitDone
      ${EndIf}

      nsis-duilib-ui::Shutdown
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
    ${ElseIfNot} ${Silent}
    ${AndIf} $OneKeyModernUninstallAccepted != "1"
      !insertmacro OneKeyModernExtractTheme
      !insertmacro OneKeyModernSelectLocale
      nsis-duilib-ui::Init "$PLUGINSDIR\onekey-modern" "$OneKeyModernLocale" "${VERSION}"
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        nsis-duilib-ui::SetPage "uninstallWelcome"
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        nsis-duilib-ui::Show
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        StrCpy $OneKeyModernUiActive "1"
        ShowWindow $HWNDPARENT ${SW_HIDE}
        nsis-duilib-ui::WaitForEvent
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult == "primary"
          StrCpy $OneKeyModernUninstallAccepted "1"
          nsis-duilib-ui::SetPage "uninstalling"
          Pop $OneKeyModernResult
          ${If} $OneKeyModernResult == "ok"
            nsis-duilib-ui::Show
            Pop $OneKeyModernResult
          ${EndIf}
          ${If} $OneKeyModernResult == "ok"
            ShowWindow $HWNDPARENT ${SW_HIDE}
            Goto OneKeyModernUnPreInitDone
          ${EndIf}
        ${Else}
          nsis-duilib-ui::ShutdownHidden
          Pop $0
          StrCpy $OneKeyModernUiActive "0"
          Quit
        ${EndIf}
      ${EndIf}

      nsis-duilib-ui::Shutdown
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
        !insertmacro OneKeyModernExtractTheme
        !insertmacro OneKeyModernSelectLocale
        nsis-duilib-ui::Init "$PLUGINSDIR\onekey-modern" "$OneKeyModernLocale" "${VERSION}"
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult == "ok"
          StrCpy $OneKeyModernUiActive "1"
        ${EndIf}
      ${Else}
        StrCpy $OneKeyModernResult "ok"
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        nsis-duilib-ui::SetPage "uninstalling"
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        nsis-duilib-ui::Show
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        StrCpy $OneKeyModernUiActive "1"
        ShowWindow $HWNDPARENT ${SW_HIDE}
      ${Else}
        nsis-duilib-ui::Shutdown
        Pop $0
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${EndIf}
    ${EndIf}
  !macroend

  !macro customUnInstall
    ${If} $OneKeyModernUiActive == "1"
      nsis-duilib-ui::SetPage "uninstalling"
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        nsis-duilib-ui::Show
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult != "ok"
        nsis-duilib-ui::Shutdown
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${Else}
        ShowWindow $HWNDPARENT ${SW_HIDE}
      ${EndIf}
    ${EndIf}
  !macroend

  !macro customUninstallPage
    UninstPage custom un.OneKeyModernUninstallFinish
  !macroend

  Function un.OneKeyModernUninstallFinish
    ${If} $OneKeyModernUiActive != "1"
      Abort
    ${EndIf}

    nsis-duilib-ui::SetProgress "100"
    Pop $OneKeyModernResult
    nsis-duilib-ui::SetPage "uninstallFinish"
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult != "ok"
      nsis-duilib-ui::Shutdown
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}

    ShowWindow $HWNDPARENT ${SW_HIDE}
    nsis-duilib-ui::WaitForEvent
    Pop $OneKeyModernResult
    nsis-duilib-ui::Shutdown
    Pop $0
    Quit
  FunctionEnd

  Function un.onUninstFailed
    ${If} $OneKeyModernUiActive == "1"
      nsis-duilib-ui::SetPage "uninstallError"
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        nsis-duilib-ui::Show
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        ShowWindow $HWNDPARENT ${SW_HIDE}
        nsis-duilib-ui::WaitForEvent
        Pop $OneKeyModernResult
        nsis-duilib-ui::Shutdown
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ${If} $OneKeyModernResult == "primary"
          ExecShell "open" "$EXEPATH"
        ${EndIf}
        Quit
      ${Else}
        nsis-duilib-ui::Shutdown
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${EndIf}
    ${EndIf}
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
    ${If} $OneKeyModernExplicitScope != ""
      Abort
    ${EndIf}
    ${If} $OneKeyModernWasInstalled == "1"
    ${AndIf} $OneKeyModernHadPerUser != $OneKeyModernHadPerMachine
      Abort
    ${EndIf}

    !insertmacro OneKeyModernExtractTheme
    !insertmacro OneKeyModernSelectLocale
    nsis-duilib-ui::Init "$PLUGINSDIR\onekey-modern" "$OneKeyModernLocale" "${VERSION}"
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "ok"
      ${If} $OneKeyModernWasInstalled == "1"
        nsis-duilib-ui::SetPage "upgradeScope"
      ${Else}
        nsis-duilib-ui::SetPage "welcome"
      ${EndIf}
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      nsis-duilib-ui::SetPerUserInstallDirectory "$OneKeyModernPerUserDirectory"
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      nsis-duilib-ui::SetPerMachineInstallDirectory "$OneKeyModernPerMachineDirectory"
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      nsis-duilib-ui::Show
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      StrCpy $OneKeyModernUiActive "1"
      ShowWindow $HWNDPARENT ${SW_HIDE}
    ${Else}
      nsis-duilib-ui::Shutdown
      Pop $0
      StrCpy $OneKeyModernDisabled "1"
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}

  OneKeyModernWelcomeLoop:
    nsis-duilib-ui::WaitForEvent
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "browse-current"
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
        nsis-duilib-ui::SetPerUserInstallDirectory "$0"
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult != "ok"
          Goto OneKeyModernWelcomeFallback
        ${EndIf}
      ${EndIf}
      nsis-duilib-ui::Show
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
        nsis-duilib-ui::SetPerMachineInstallDirectory "$0"
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult != "ok"
          Goto OneKeyModernWelcomeFallback
        ${EndIf}
      ${EndIf}
      nsis-duilib-ui::Show
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
        nsis-duilib-ui::Hide
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
        nsis-duilib-ui::Show
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult != "ok"
          Goto OneKeyModernWelcomeFallback
        ${EndIf}
        ShowWindow $HWNDPARENT ${SW_HIDE}
        Goto OneKeyModernWelcomeLoop
      ${EndIf}
      Goto OneKeyModernWelcomeProceed
    ${Else}
      nsis-duilib-ui::ShutdownHidden
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      Quit
    ${EndIf}

  OneKeyModernWelcomeProceed:
    ${If} $OneKeyModernWasInstalled == "0"
      nsis-duilib-ui::SetPage "installing"
    ${Else}
      nsis-duilib-ui::SetPage "upgrade"
    ${EndIf}
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "ok"
    ${AndIf} $OneKeyModernWasInstalled == "0"
      nsis-duilib-ui::ResetProgress "0"
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      nsis-duilib-ui::Show
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult != "ok"
      Goto OneKeyModernWelcomeFallback
    ${EndIf}
    StrCpy $OneKeyModernUiActive "1"
    ShowWindow $HWNDPARENT ${SW_HIDE}
    Abort

  OneKeyModernWelcomeFallback:
    nsis-duilib-ui::Shutdown
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

    ${If} $OneKeyModernWasInstalled == "0"
    ${AndIf} $OneKeyModernChosenDirectory != ""
      StrCpy $INSTDIR "$OneKeyModernChosenDirectory"
    ${EndIf}

    ${If} $OneKeyModernUiActive == "1"
      nsis-duilib-ui::ConcealHost
      Pop $OneKeyModernResult
    ${Else}
      !insertmacro OneKeyModernExtractTheme
      !insertmacro OneKeyModernSelectLocale
      nsis-duilib-ui::Init "$PLUGINSDIR\onekey-modern" "$OneKeyModernLocale" "${VERSION}"
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        ${If} $OneKeyModernAccepted == "1"
          nsis-duilib-ui::SetPage "installing"
        ${Else}
          nsis-duilib-ui::SetPage "upgrade"
        ${EndIf}
        Pop $OneKeyModernResult
      ${EndIf}
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      nsis-duilib-ui::SetInstallDirectory "$INSTDIR"
      Pop $OneKeyModernResult
    ${EndIf}
    ${If} $OneKeyModernResult == "ok"
      nsis-duilib-ui::Show
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
      nsis-duilib-ui::ResetProgress "0"
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        Abort
      ${EndIf}
      Goto OneKeyModernInstallFallback
    ${EndIf}

    nsis-duilib-ui::WaitForEvent
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "primary"
      nsis-duilib-ui::ResetProgress "0"
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        nsis-duilib-ui::SetPage "installing"
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        Abort
      ${EndIf}
      Goto OneKeyModernInstallFallback
    ${Else}
      nsis-duilib-ui::ShutdownHidden
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      Quit
    ${EndIf}

  OneKeyModernInstallFallback:
    nsis-duilib-ui::Shutdown
    Pop $0
    StrCpy $OneKeyModernUiActive "0"
    StrCpy $OneKeyModernDisabled "1"
    ShowWindow $HWNDPARENT ${SW_SHOW}
    Abort
  FunctionEnd

  !macro customInstall
    ${If} $OneKeyModernUiActive == "1"
      # Native mirroring has already reported intermediate progress.
      nsis-duilib-ui::SetProgress "100"
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult != "ok"
        nsis-duilib-ui::Shutdown
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${EndIf}
    ${EndIf}
  !macroend

  Function OneKeyModernInstallFinish
    ${If} $OneKeyModernUiActive != "1"
      Abort
    ${EndIf}

    nsis-duilib-ui::SetPage "finish"
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult != "ok"
      nsis-duilib-ui::Shutdown
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}

  OneKeyModernFinishWait:
    ShowWindow $HWNDPARENT ${SW_HIDE}
    nsis-duilib-ui::WaitForEvent
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "primary"
      Call OneKeyModernStartApp
      ${If} $0 != "ok"
      ${AndIf} $0 != "fallback"
        nsis-duilib-ui::SetPage "finish"
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult == "ok"
          Goto OneKeyModernFinishWait
        ${EndIf}
        Goto OneKeyModernFinishFallback
      ${EndIf}
    ${EndIf}

    nsis-duilib-ui::Shutdown
    Pop $0
    StrCpy $OneKeyModernUiActive "0"
    SetErrorLevel 0
    Quit

  OneKeyModernFinishFallback:
    nsis-duilib-ui::Shutdown
    Pop $0
    StrCpy $OneKeyModernUiActive "0"
    ShowWindow $HWNDPARENT ${SW_SHOW}
    Abort
  FunctionEnd

  Function .onInstFailed
    ${If} $OneKeyModernUiActive == "1"
      nsis-duilib-ui::SetPage "error"
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        nsis-duilib-ui::Show
        Pop $OneKeyModernResult
      ${EndIf}
      ${If} $OneKeyModernResult == "ok"
        ShowWindow $HWNDPARENT ${SW_HIDE}
        nsis-duilib-ui::WaitForEvent
        Pop $OneKeyModernResult
        nsis-duilib-ui::Shutdown
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ${If} $OneKeyModernResult == "primary"
          ExecShell "open" "$EXEPATH"
        ${EndIf}
        Quit
      ${Else}
        nsis-duilib-ui::Shutdown
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${EndIf}
    ${EndIf}
  FunctionEnd

!endif
