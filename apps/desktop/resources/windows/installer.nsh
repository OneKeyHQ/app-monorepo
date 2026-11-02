!include "LogicLib.nsh"

!define ONEKEY_APP_USER_MODEL_ID "OneKey Wallet"
!define ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY "Software\Classes\AppUserModelId\${ONEKEY_APP_USER_MODEL_ID}"

!macro OneKeyDeleteProtocolKeyIfOwnedByDir ROOT_KEY SCHEME TARGET_DIR
  ${If} "${TARGET_DIR}" != ""
    ReadRegStr $R9 ${ROOT_KEY} "Software\Classes\${SCHEME}\shell\open\command" ""
    ${If} $R9 == '"${TARGET_DIR}\${APP_EXECUTABLE_FILENAME}" "--" "%1"'
    ${OrIf} $R9 == '"${TARGET_DIR}\${APP_EXECUTABLE_FILENAME}" "%1"'
      DeleteRegKey ${ROOT_KEY} "Software\Classes\${SCHEME}"
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
    !ifndef BUILD_UNINSTALLER
      !ifndef INSTALL_MODE_PER_ALL_USERS
        !insertmacro OneKeyDeleteProtocolKeyIfOwnedByDir ${ROOT_KEY} "${SCHEME}" "$perUserInstallationFolder"
      !endif
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

!macro customInstall
  !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
    ${if} ${FileExists} "$newStartMenuLink"
      ClearErrors
      WinShell::SetLnkAUMI "$newStartMenuLink" "${ONEKEY_APP_USER_MODEL_ID}"
    ${endIf}
  !endif

  WriteRegExpandStr SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegExpandStr SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}" "IconUri" "$INSTDIR\resources\windows\notificationIcon.png"
  !insertmacro OneKeyRegisterProtocolScheme "onekey-wallet" "URL:OneKey Protocol"
  !insertmacro OneKeyRegisterProtocolScheme "wc" "URL:WalletConnect Protocol"
  !insertmacro OneKeyRegisterProtocolScheme "ethereum" "URL:Ethereum Protocol"
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}"
  !insertmacro OneKeyUnregisterProtocolSchemes
!macroend
