!define ONEKEY_APP_USER_MODEL_ID "OneKey Wallet"
!define ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY "Software\Classes\AppUserModelId\${ONEKEY_APP_USER_MODEL_ID}"

!macro customInstall
  !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
    ${if} ${FileExists} "$newStartMenuLink"
      ClearErrors
      WinShell::SetLnkAUMI "$newStartMenuLink" "${ONEKEY_APP_USER_MODEL_ID}"
    ${endIf}
  !endif

  WriteRegExpandStr SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegExpandStr SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}" "IconUri" "$INSTDIR\resources\windows\notificationIcon.png"
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}"
!macroend
