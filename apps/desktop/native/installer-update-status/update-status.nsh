!ifndef ONEKEY_UPDATE_STATUS_NSH
!define ONEKEY_UPDATE_STATUS_NSH

!ifndef ONEKEY_UPDATE_STATUS_PLUGIN_DIR
  !define ONEKEY_UPDATE_STATUS_PLUGIN_DIR "${BUILD_RESOURCES_DIR}\installer-generated"
!endif
!addplugindir /x86-unicode "${ONEKEY_UPDATE_STATUS_PLUGIN_DIR}"

!macro OneKeyStartUpdateStatus LOCALE
  ${If} ${Silent}
    # Electron Builder's flag macros use $R9. Preserve it and the error flag
    # even if the optional plug-in fails to load.
    Push $0
    Push $R9
    StrCpy $0 "0"
    ${If} ${Errors}
      StrCpy $0 "1"
    ${EndIf}
    ${If} ${isUpdated}
    ${AndIf} ${isForceRun}
      Push "${LOCALE}"
      OneKeyUpdateStatus::Start
      Pop $R9
    ${EndIf}
    ClearErrors
    ${If} $0 == "1"
      SetErrors
    ${EndIf}
    Pop $R9
    Pop $0
  ${EndIf}
!macroend

!endif
