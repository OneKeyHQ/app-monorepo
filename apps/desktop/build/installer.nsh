# OneKey modern installer UI. The native NSIS window remains untouched until
# the plugin and the complete theme package have both initialized successfully.

!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "nsDialogs.nsh"
!addplugindir /x86-unicode "${BUILD_RESOURCES_DIR}\nsis-duilib-ui\plugin\x86-unicode"

Var OneKeyModernUiActive
Var OneKeyModernLocale
Var OneKeyModernResult

# Keep upgrades in their existing install scope and use per-user installs for
# fresh setups. This makes electron-builder's native install-mode page skip
# itself while preserving its elevation and registry handling.
!macro customInstallMode
  ${If} $hasPerMachineInstallation == "1"
  ${AndIf} $hasPerUserInstallation == "0"
    StrCpy $isForceMachineInstall "1"
  ${Else}
    StrCpy $isForceCurrentInstall "1"
  ${EndIf}
!macroend

!macro OneKeyModernExtractTheme
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\onekey-modern"
  File /r "${BUILD_RESOURCES_DIR}\nsis-duilib-ui\onekey-modern\*.*"
  SetOutPath "$PLUGINSDIR\onekey-modern\licenses"
  File /r "${BUILD_RESOURCES_DIR}\nsis-duilib-ui\licenses\*.*"
!macroend

!macro OneKeyModernSelectLocale
  StrCpy $OneKeyModernLocale "en-US"
  StrCmp $LANGUAGE "2052" 0 +2
  StrCpy $OneKeyModernLocale "zh-CN"
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
      nsis-duilib-ui::Shutdown
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
    ${EndIf}
  FunctionEnd

!else

  !macro customWelcomePage
    Page custom OneKeyModernInstallStart
  !macroend

  Function OneKeyModernInstallStart
    ${If} ${Silent}
      Abort
    ${EndIf}

    !insertmacro OneKeyModernExtractTheme
    !insertmacro OneKeyModernSelectLocale
    nsis-duilib-ui::Init "$PLUGINSDIR\onekey-modern" "$OneKeyModernLocale" "${VERSION}"
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "ok"
      nsis-duilib-ui::SetPage "welcome"
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
      StrCpy $OneKeyModernUiActive "0"
      nsis-duilib-ui::Shutdown
      Pop $0
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}

  OneKeyModernWelcomeLoop:
    nsis-duilib-ui::WaitForEvent
    Pop $OneKeyModernResult
    ${If} $OneKeyModernResult == "browse"
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
      nsis-duilib-ui::SetPage "installing"
      Pop $OneKeyModernResult
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
      nsis-duilib-ui::Shutdown
      Pop $0
      StrCpy $OneKeyModernUiActive "0"
      ShowWindow $HWNDPARENT ${SW_SHOW}
    ${EndIf}
  FunctionEnd

!endif
