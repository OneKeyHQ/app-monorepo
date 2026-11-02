!define ONEKEY_APP_USER_MODEL_ID "OneKey Wallet"
!define ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY "Software\Classes\AppUserModelId\${ONEKEY_APP_USER_MODEL_ID}"

!macro OneKeyUnregisterSharedProtocolIfOwned ROOT_KEY SCHEME
  ReadRegStr $R9 ${ROOT_KEY} "Software\Classes\${SCHEME}\shell\open\command" ""
  ${If} $R9 == '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--" "%1"'
  ${OrIf} $R9 == '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    DeleteRegKey ${ROOT_KEY} "Software\Classes\${SCHEME}"
  ${EndIf}
  ClearErrors
!macroend

!macro OneKeyRegisterProtocolScheme SCHEME DESCRIPTION
  ${If} "${SCHEME}" == "onekey-wallet"
    DeleteRegKey HKCU "Software\Classes\${SCHEME}"
  ${Else}
    !insertmacro OneKeyUnregisterSharedProtocolIfOwned HKCU "${SCHEME}"
  ${EndIf}
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}" "" "${DESCRIPTION}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}\shell\open\command" "" '"$appExe" "--" "%1"'
  ClearErrors
!macroend

!macro OneKeyUnregisterProtocolSchemes
  DeleteRegKey SHELL_CONTEXT "Software\Classes\onekey-wallet"
  DeleteRegKey HKCU "Software\Classes\onekey-wallet"
  !insertmacro OneKeyUnregisterSharedProtocolIfOwned SHELL_CONTEXT "wc"
  !insertmacro OneKeyUnregisterSharedProtocolIfOwned HKCU "wc"
  !insertmacro OneKeyUnregisterSharedProtocolIfOwned SHELL_CONTEXT "ethereum"
  !insertmacro OneKeyUnregisterSharedProtocolIfOwned HKCU "ethereum"
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
