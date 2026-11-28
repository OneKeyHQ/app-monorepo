!ifdef ONEKEY_USE_WIN32_INSTALLER_UI
  !addplugindir /x86-unicode "${BUILD_RESOURCES_DIR}\installer-generated\native-ui\Release"
!endif

!macro OneKeyInstallerMessage FLAGS EN ZH
  Push $R9
  System::Call 'Kernel32::GetUserDefaultUILanguage() i .R9'
  ${If} $R9 == 2052
    MessageBox ${FLAGS} "${ZH}"
  ${Else}
    MessageBox ${FLAGS} "${EN}"
  ${EndIf}
  Pop $R9
!macroend

Var OneKeyModernRendererReady

!ifdef BUILD_UNINSTALLER
  !define ONEKEY_RENDERER_INIT "un.OneKeyInitializeRenderer"
!else
  !define ONEKEY_RENDERER_INIT "OneKeyInitializeRenderer"
!endif

Function ${ONEKEY_RENDERER_INIT}
  StrCpy $OneKeyModernRendererReady "0"
  StrCpy $OneKeyModernResult "error:installer renderer unavailable"
  !ifdef ONEKEY_USE_WIN32_INSTALLER_UI
    InitPluginsDir
    ClearErrors
    onekey-installer-ui::Init "$OneKeyModernLocale" "${VERSION}"
    ${If} ${Errors}
      # NSIS leaves the plugin arguments on the stack if loading the DLL fails.
      Pop $OneKeyModernResult
      Pop $OneKeyModernResult
      StrCpy $OneKeyModernResult "error:installer renderer unavailable"
      ClearErrors
    ${Else}
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "ok"
        StrCpy $OneKeyModernRendererReady "1"
      ${EndIf}
    ${EndIf}
  !endif
  Push $OneKeyModernResult
FunctionEnd

!macro OneKeyModernRendererInit
  Call ${ONEKEY_RENDERER_INIT}
!macroend

!macro OneKeyModernRendererCall ENTRY ARGUMENTS
  !ifdef ONEKEY_USE_WIN32_INSTALLER_UI
    ${If} $OneKeyModernRendererReady == "1"
      onekey-installer-ui::${ENTRY} ${ARGUMENTS}
    ${Else}
      Push "error:installer renderer unavailable"
    ${EndIf}
  !else
    Push "error:installer renderer unavailable"
  !endif
!macroend
