# OneKey modern installer UI. The native NSIS window remains untouched until
# the plugin and the complete theme package have both initialized successfully.

!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "nsDialogs.nsh"
!addplugindir /x86-unicode "${BUILD_RESOURCES_DIR}\nsis-duilib-ui\plugin\x86-unicode"

Var OneKeyModernUiActive
Var OneKeyModernLocale
Var OneKeyModernResult

!ifndef BUILD_UNINSTALLER
  Var OneKeyModernInstallScope
  Var OneKeyModernWasInstalled
  Var OneKeyModernHadPerUser
  Var OneKeyModernHadPerMachine
  Var OneKeyModernExplicitScope
  Var OneKeyModernDisabled
  Var OneKeyModernIsInner
  Var OneKeyModernPerUserDirectory
  Var OneKeyModernPerMachineDirectory

# Snapshot the registry-backed state after electron-builder has resolved it in
# initMultiUser. Command-line /allusers and /currentuser flags affect the
# effective mode, but do not turn a fresh installation into an upgrade.
!macro customInit
  StrCpy $OneKeyModernInstallScope ""
  StrCpy $OneKeyModernExplicitScope ""
  StrCpy $OneKeyModernDisabled "0"
  StrCpy $OneKeyModernHadPerUser "0"
  StrCpy $OneKeyModernHadPerMachine "0"
  StrCpy $OneKeyModernWasInstalled "0"
  StrCpy $OneKeyModernIsInner "0"
  StrCpy $OneKeyModernPerUserDirectory "$perUserInstallationFolder"
  StrCpy $OneKeyModernPerMachineDirectory "$perMachineInstallationFolder"

  ${If} ${UAC_IsInnerInstance}
    StrCpy $OneKeyModernIsInner "1"
  ${EndIf}

  ${If} $perUserInstallationFolder != ""
    StrCpy $OneKeyModernHadPerUser "1"
    StrCpy $OneKeyModernWasInstalled "1"
  ${EndIf}
  ${If} $perMachineInstallationFolder != ""
    StrCpy $OneKeyModernHadPerMachine "1"
    StrCpy $OneKeyModernWasInstalled "1"
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
!macroend

# Hide the native NSIS host before its first frame is painted. Every modern
# UI initialization failure path restores it before falling back.
!define MUI_CUSTOMFUNCTION_GUIINIT OneKeyModernOnGuiInit
Function OneKeyModernOnGuiInit
  ${IfNot} ${Silent}
    ShowWindow $HWNDPARENT ${SW_HIDE}
  ${EndIf}
FunctionEnd

# The hidden electron-builder install-mode page remains authoritative for
# elevation, registry scope, and the default directory. The modern scope page
# only supplies a choice when the registry/command line did not already do so.
!macro customInstallMode
  ${If} $hasPerMachineInstallation == "1"
  ${AndIf} $hasPerUserInstallation == "0"
    StrCpy $isForceMachineInstall "1"
  ${ElseIf} $hasPerUserInstallation == "1"
  ${AndIf} $hasPerMachineInstallation == "0"
    StrCpy $isForceCurrentInstall "1"
  ${ElseIf} $OneKeyModernInstallScope == "all"
    StrCpy $isForceMachineInstall "1"
  ${ElseIf} $OneKeyModernInstallScope == "current"
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

  !macro customUnInstall
    ${IfNot} ${Silent}
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
      ${Else}
        StrCpy $OneKeyModernUiActive "0"
        nsis-duilib-ui::Shutdown
        Pop $0
        ShowWindow $HWNDPARENT ${SW_SHOW}
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
    Page custom OneKeyModernScopeStart
  !macroend

  # This page runs after initMultiUser resolved both registry locations, but
  # before electron-builder's hidden install-mode page performs elevation.
  Function OneKeyModernScopeStart
    ${If} ${Silent}
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
        nsis-duilib-ui::SetPage "scope"
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
      ShowWindow $HWNDPARENT ${SW_HIDE}
    ${Else}
      nsis-duilib-ui::Shutdown
      Pop $0
      StrCpy $OneKeyModernDisabled "1"
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}

    nsis-duilib-ui::WaitForEvent
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "scope-current"
      StrCpy $OneKeyModernInstallScope "current"
    ${ElseIf} $OneKeyModernResult == "scope-all"
      StrCpy $OneKeyModernInstallScope "all"
    ${Else}
      nsis-duilib-ui::Shutdown
      Pop $0
      Quit
    ${EndIf}

    nsis-duilib-ui::Shutdown
    Pop $0
    StrCpy $OneKeyModernUiActive "0"
    ShowWindow $HWNDPARENT ${SW_HIDE}
    Abort
  FunctionEnd

  !macro customPageAfterChangeDir
    Page custom OneKeyModernInstallStart
  !macroend

  # This page deliberately runs after the hidden install-mode page. At this
  # point $INSTDIR contains the selected scope's registry/default path, so a
  # fresh directory choice cannot be overwritten by setInstallModePerUser or
  # setInstallModePerAllUsers. Upgrade paths remain read-only.
  Function OneKeyModernInstallStart
    ${If} ${Silent}
    ${OrIf} $OneKeyModernDisabled == "1"
      Abort
    ${EndIf}

    !insertmacro OneKeyModernExtractTheme
    !insertmacro OneKeyModernSelectLocale
    nsis-duilib-ui::Init "$PLUGINSDIR\onekey-modern" "$OneKeyModernLocale" "${VERSION}"
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "ok"
      ${If} $OneKeyModernWasInstalled == "1"
        nsis-duilib-ui::SetPage "upgrade"
      ${Else}
        nsis-duilib-ui::SetPage "welcome"
      ${EndIf}
      Pop $OneKeyModernResult
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

  OneKeyModernWelcomeLoop:
    nsis-duilib-ui::WaitForEvent
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "browse"
      ${If} $OneKeyModernWasInstalled == "1"
        Goto OneKeyModernWelcomeLoop
      ${EndIf}
      nsDialogs::SelectFolderDialog "$(^DirText)" "$INSTDIR"
      Pop $0
      ${If} $0 != ""
        StrCpy $INSTDIR "$0"
        nsis-duilib-ui::SetInstallDirectory "$INSTDIR"
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult != "ok"
          Goto OneKeyModernInstallFallback
        ${EndIf}
      ${EndIf}
      Goto OneKeyModernWelcomeLoop
    ${ElseIf} $OneKeyModernResult == "primary"
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
      nsis-duilib-ui::Shutdown
      Pop $0
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
      nsis-duilib-ui::SetProgress "100"
      Pop $OneKeyModernResult
      nsis-duilib-ui::SetPage "finish"
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        ShowWindow $HWNDPARENT ${SW_HIDE}
        nsis-duilib-ui::WaitForEvent
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult == "primary"
          ${If} ${isUpdated}
            StrCpy $1 "--updated"
          ${Else}
            StrCpy $1 ""
          ${EndIf}
          ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
        ${EndIf}
        nsis-duilib-ui::Shutdown
        Pop $0
        Quit
      ${Else}
        nsis-duilib-ui::Shutdown
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
      ${EndIf}
    ${EndIf}
  !macroend

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
