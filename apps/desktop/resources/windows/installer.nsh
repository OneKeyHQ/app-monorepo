!define ONEKEY_APP_USER_MODEL_ID "OneKey Wallet"
!define ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY "Software\Classes\AppUserModelId\${ONEKEY_APP_USER_MODEL_ID}"

!macro OneKeyRegisterProtocolScheme SCHEME DESCRIPTION
  DeleteRegKey HKCU "Software\Classes\${SCHEME}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}" "" "${DESCRIPTION}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${SCHEME}\shell\open\command" "" '"$appExe" "--" "%1"'
  ClearErrors
!macroend

!macro OneKeyUnregisterProtocolSchemes
  DeleteRegKey SHELL_CONTEXT "Software\Classes\onekey-wallet"
  DeleteRegKey HKCU "Software\Classes\onekey-wallet"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\wc"
  DeleteRegKey HKCU "Software\Classes\wc"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\ethereum"
  DeleteRegKey HKCU "Software\Classes\ethereum"
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
