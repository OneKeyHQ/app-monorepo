# OneKey modern installer UI. The native NSIS window remains untouched until
# the plugin and the complete theme package have both initialized successfully.

!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "nsDialogs.nsh"
!addplugindir /x86-unicode "${BUILD_RESOURCES_DIR}\nsis-duilib-ui\plugin\x86-unicode"

!define ONEKEY_APP_USER_MODEL_ID "OneKey Wallet"
!define ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY "Software\Classes\AppUserModelId\${ONEKEY_APP_USER_MODEL_ID}"

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

  !define /redef APP_PRODUCT_FILENAME "OneKey Wallet"
  Var OneKeyUninstallWelcomeText
  Var OneKeyModernUninstallAccepted
  Var OneKeyModernUninstallOriginalDirectory
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
    !define MUI_WELCOMEPAGE_TEXT "$OneKeyUninstallWelcomeText"
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
    ${If} $OneKeyModernUninstallOriginalDirectory == $perMachineInstallationFolder
      StrCpy $isForceMachineInstall "1"
    ${ElseIf} $OneKeyModernUninstallOriginalDirectory == $perUserInstallationFolder
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
    StrCpy $OneKeyModernUninstallOriginalDirectory "$INSTDIR"
    StrCpy $OneKeyModernUiActive "0"
    StrCpy $OneKeyModernIsInner "0"
    StrCpy $OneKeyModernUninstallAccepted "0"
    ${If} ${UAC_IsInnerInstance}
      StrCpy $OneKeyModernIsInner "1"
      !insertmacro UAC_AsUser_GetGlobal $OneKeyModernUninstallAccepted $OneKeyModernUninstallAccepted
      !insertmacro UAC_AsUser_GetGlobal $OneKeyModernUninstallOriginalDirectory $OneKeyModernUninstallOriginalDirectory
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
    StrCpy $OneKeyUninstallWelcomeText "This wizard will uninstall $(^NameDA) and permanently delete all local user data, including wallets and settings.$\r$\n$\r$\nMake sure you have backed up your recovery phrases or private keys before continuing.$\r$\n$\r$\nClick Next to continue."
    ${if} $LANGUAGE == ${LANG_SIMPCHINESE}
      StrCpy $OneKeyUninstallWelcomeText "此向导将卸载 $(^NameDA)，并永久删除本地的所有用户数据，包括钱包和设置。$\r$\n$\r$\n继续前，请确保已备份助记词或私钥。$\r$\n$\r$\n点击“下一步”继续。"
    ${elseif} $LANGUAGE == ${LANG_TRADCHINESE}
      StrCpy $OneKeyUninstallWelcomeText "此精靈將解除安裝 $(^NameDA)，並永久刪除本機的所有使用者資料，包括錢包和設定。$\r$\n$\r$\n繼續前，請確保已備份助記詞或私鑰。$\r$\n$\r$\n按一下「下一步」繼續。"
    ${elseif} $LANGUAGE == ${LANG_GERMAN}
      StrCpy $OneKeyUninstallWelcomeText "Dieser Assistent deinstalliert $(^NameDA) und löscht alle lokalen Benutzerdaten, einschließlich Wallets und Einstellungen, dauerhaft.$\r$\n$\r$\nStellen Sie sicher, dass Sie Ihre Wiederherstellungsphrasen oder privaten Schlüssel gesichert haben, bevor Sie fortfahren.$\r$\n$\r$\nKlicken Sie auf „Weiter“, um fortzufahren."
    ${elseif} $LANGUAGE == ${LANG_FRENCH}
      StrCpy $OneKeyUninstallWelcomeText "Cet assistant désinstallera $(^NameDA) et supprimera définitivement toutes les données utilisateur locales, y compris les portefeuilles et les paramètres.$\r$\n$\r$\nAssurez-vous d'avoir sauvegardé vos phrases de récupération ou vos clés privées avant de continuer.$\r$\n$\r$\nCliquez sur « Suivant » pour continuer."
    ${elseif} $LANGUAGE == ${LANG_SPANISHINTERNATIONAL}
      StrCpy $OneKeyUninstallWelcomeText "Este asistente desinstalará $(^NameDA) y eliminará permanentemente todos los datos locales del usuario, incluidas las carteras y la configuración.$\r$\n$\r$\nAsegúrese de haber guardado una copia de sus frases de recuperación o claves privadas antes de continuar.$\r$\n$\r$\nHaga clic en «Siguiente» para continuar."
    ${elseif} $LANGUAGE == ${LANG_JAPANESE}
      StrCpy $OneKeyUninstallWelcomeText "このウィザードは $(^NameDA) をアンインストールし、ウォレットや設定を含むすべてのローカルユーザーデータを完全に削除します。$\r$\n$\r$\n続行する前に、リカバリーフレーズまたは秘密鍵をバックアップしたことを確認してください。$\r$\n$\r$\n「次へ」をクリックして続行してください。"
    ${elseif} $LANGUAGE == ${LANG_KOREAN}
      StrCpy $OneKeyUninstallWelcomeText "이 마법사는 $(^NameDA)을(를) 제거하고 지갑 및 설정을 포함한 모든 로컬 사용자 데이터를 영구적으로 삭제합니다.$\r$\n$\r$\n계속하기 전에 복구 구문 또는 개인 키를 백업했는지 확인하세요.$\r$\n$\r$\n계속하려면 '다음'을 클릭하세요."
    ${elseif} $LANGUAGE == ${LANG_ITALIAN}
      StrCpy $OneKeyUninstallWelcomeText "Questa procedura guidata disinstallerà $(^NameDA) ed eliminerà definitivamente tutti i dati utente locali, inclusi i portafogli e le impostazioni.$\r$\n$\r$\nPrima di continuare, assicurati di aver eseguito il backup delle frasi di recupero o delle chiavi private.$\r$\n$\r$\nFai clic su «Avanti» per continuare."
    ${elseif} $LANGUAGE == ${LANG_DUTCH}
      StrCpy $OneKeyUninstallWelcomeText "Deze wizard verwijdert $(^NameDA) en wist alle lokale gebruikersgegevens permanent, inclusief wallets en instellingen.$\r$\n$\r$\nZorg dat u een back-up van uw herstelzinnen of privésleutels hebt gemaakt voordat u doorgaat.$\r$\n$\r$\nKlik op 'Volgende' om door te gaan."
    ${elseif} $LANGUAGE == ${LANG_DANISH}
      StrCpy $OneKeyUninstallWelcomeText "Denne guide afinstallerer $(^NameDA) og sletter alle lokale brugerdata permanent, herunder wallets og indstillinger.$\r$\n$\r$\nSørg for, at du har sikkerhedskopieret dine gendannelsesfraser eller private nøgler, før du fortsætter.$\r$\n$\r$\nKlik på 'Næste' for at fortsætte."
    ${elseif} $LANGUAGE == ${LANG_SWEDISH}
      StrCpy $OneKeyUninstallWelcomeText "Den här guiden avinstallerar $(^NameDA) och raderar alla lokala användardata permanent, inklusive plånböcker och inställningar.$\r$\n$\r$\nSe till att du har säkerhetskopierat dina återställningsfraser eller privata nycklar innan du fortsätter.$\r$\n$\r$\nKlicka på 'Nästa' för att fortsätta."
    ${elseif} $LANGUAGE == ${LANG_NORWEGIAN}
      StrCpy $OneKeyUninstallWelcomeText "Denne veiviseren avinstallerer $(^NameDA) og sletter alle lokale brukerdata permanent, inkludert lommebøker og innstillinger.$\r$\n$\r$\nSørg for at du har sikkerhetskopiert gjenopprettingsfrasene eller de private nøklene dine før du fortsetter.$\r$\n$\r$\nKlikk på 'Neste' for å fortsette."
    ${elseif} $LANGUAGE == ${LANG_FINNISH}
      StrCpy $OneKeyUninstallWelcomeText "Tämä ohjattu toiminto poistaa $(^NameDA)-sovelluksen ja kaikki paikalliset käyttäjätiedot pysyvästi, mukaan lukien lompakot ja asetukset.$\r$\n$\r$\nVarmista ennen jatkamista, että olet varmuuskopioinut palautuslauseesi tai yksityiset avaimesi.$\r$\n$\r$\nJatka napsauttamalla Seuraava."
    ${elseif} $LANGUAGE == ${LANG_RUSSIAN}
      StrCpy $OneKeyUninstallWelcomeText "Этот мастер удалит $(^NameDA) и безвозвратно удалит все локальные данные пользователя, включая кошельки и настройки.$\r$\n$\r$\nПеред продолжением убедитесь, что вы сохранили резервную копию фраз восстановления или приватных ключей.$\r$\n$\r$\nНажмите «Далее», чтобы продолжить."
    ${elseif} $LANGUAGE == ${LANG_PORTUGUESE}
      StrCpy $OneKeyUninstallWelcomeText "Este assistente irá desinstalar $(^NameDA) e eliminar permanentemente todos os dados locais do utilizador, incluindo carteiras e definições.$\r$\n$\r$\nAntes de continuar, certifique-se de que fez uma cópia de segurança das suas frases de recuperação ou chaves privadas.$\r$\n$\r$\nClique em «Seguinte» para continuar."
    ${elseif} $LANGUAGE == ${LANG_PORTUGUESEBR}
      StrCpy $OneKeyUninstallWelcomeText "Este assistente desinstalará $(^NameDA) e excluirá permanentemente todos os dados locais do usuário, incluindo carteiras e configurações.$\r$\n$\r$\nAntes de continuar, certifique-se de ter feito um backup das suas frases de recuperação ou chaves privadas.$\r$\n$\r$\nClique em 'Próximo' para continuar."
    ${elseif} $LANGUAGE == ${LANG_POLISH}
      StrCpy $OneKeyUninstallWelcomeText "Ten kreator odinstaluje $(^NameDA) i trwale usunie wszystkie lokalne dane użytkownika, w tym portfele i ustawienia.$\r$\n$\r$\nPrzed kontynuowaniem upewnij się, że masz kopię zapasową fraz odzyskiwania lub kluczy prywatnych.$\r$\n$\r$\nKliknij „Dalej”, aby kontynuować."
    ${elseif} $LANGUAGE == ${LANG_UKRAINIAN}
      StrCpy $OneKeyUninstallWelcomeText "Цей майстер видалить $(^NameDA) і назавжди видалить усі локальні дані користувача, зокрема гаманці та налаштування.$\r$\n$\r$\nПерш ніж продовжити, переконайтеся, що ви створили резервну копію фраз відновлення або приватних ключів.$\r$\n$\r$\nНатисніть «Далі», щоб продовжити."
    ${elseif} $LANGUAGE == ${LANG_CZECH}
      StrCpy $OneKeyUninstallWelcomeText "Tento průvodce odinstaluje $(^NameDA) a trvale odstraní všechna místní uživatelská data, včetně peněženek a nastavení.$\r$\n$\r$\nNež budete pokračovat, ujistěte se, že máte zálohované fráze pro obnovení nebo soukromé klíče.$\r$\n$\r$\nPokračujte kliknutím na tlačítko „Další“."
    ${elseif} $LANGUAGE == ${LANG_SLOVAK}
      StrCpy $OneKeyUninstallWelcomeText "Tento sprievodca odinštaluje $(^NameDA) a natrvalo odstráni všetky miestne používateľské údaje vrátane peňaženiek a nastavení.$\r$\n$\r$\nPred pokračovaním sa uistite, že máte zálohované frázy na obnovenie alebo súkromné kľúče.$\r$\n$\r$\nPokračujte kliknutím na tlačidlo „Ďalej“."
    ${elseif} $LANGUAGE == ${LANG_HUNGARIAN}
      StrCpy $OneKeyUninstallWelcomeText "Ez a varázsló eltávolítja a(z) $(^NameDA) alkalmazást, és véglegesen törli az összes helyi felhasználói adatot, beleértve a tárcákat és a beállításokat.$\r$\n$\r$\nA folytatás előtt győződjön meg arról, hogy biztonsági másolatot készített a helyreállítási kifejezésekről vagy a privát kulcsokról.$\r$\n$\r$\nA folytatáshoz kattintson a „Tovább” gombra."
    ${elseif} $LANGUAGE == ${LANG_ARABIC}
      StrCpy $OneKeyUninstallWelcomeText "سيزيل هذا المعالج $(^NameDA) ويحذف جميع بيانات المستخدم المحلية نهائياً، بما في ذلك المحافظ والإعدادات.$\r$\n$\r$\nقبل المتابعة، تأكد من الاحتفاظ بنسخة احتياطية من عبارات الاسترداد أو المفاتيح الخاصة.$\r$\n$\r$\nانقر على «التالي» للمتابعة."
    ${elseif} $LANGUAGE == ${LANG_TURKISH}
      StrCpy $OneKeyUninstallWelcomeText "Bu sihirbaz $(^NameDA) uygulamasını kaldıracak ve cüzdanlar ile ayarlar dahil tüm yerel kullanıcı verilerini kalıcı olarak silecektir.$\r$\n$\r$\nDevam etmeden önce kurtarma ifadelerinizi veya özel anahtarlarınızı yedeklediğinizden emin olun.$\r$\n$\r$\nDevam etmek için 'İleri'ye tıklayın."
    ${elseif} $LANGUAGE == ${LANG_THAI}
      StrCpy $OneKeyUninstallWelcomeText "ตัวช่วยนี้จะถอนการติดตั้ง $(^NameDA) และลบข้อมูลผู้ใช้ทั้งหมดที่จัดเก็บในเครื่องอย่างถาวร รวมถึงกระเป๋าเงินและการตั้งค่า$\r$\n$\r$\nก่อนดำเนินการต่อ โปรดตรวจสอบว่าคุณได้สำรองวลีการกู้คืนหรือคีย์ส่วนตัวแล้ว$\r$\n$\r$\nคลิก 'ถัดไป' เพื่อดำเนินการต่อ"
    ${elseif} $LANGUAGE == ${LANG_VIETNAMESE}
      StrCpy $OneKeyUninstallWelcomeText "Trình hướng dẫn này sẽ gỡ cài đặt $(^NameDA) và xóa vĩnh viễn tất cả dữ liệu người dùng trên máy, bao gồm ví và cài đặt.$\r$\n$\r$\nTrước khi tiếp tục, hãy đảm bảo bạn đã sao lưu cụm từ khôi phục hoặc khóa riêng tư.$\r$\n$\r$\nNhấp vào 'Tiếp' để tiếp tục."
    ${endif}
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
      OneKeyModernUninstallPrepareCommit:
        nsis-duilib-ui::PrepareCommit
        Pop $OneKeyModernResult
        ${If} $OneKeyModernResult == "pending"
          Sleep 80
          Goto OneKeyModernUninstallPrepareCommit
        ${ElseIf} $OneKeyModernResult == "cancel"
          nsis-duilib-ui::ShutdownHidden
          Pop $0
          StrCpy $OneKeyModernUiActive "0"
          SetErrorLevel 1
          Quit
        ${EndIf}
      ${EndIf}
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
    DeleteRegKey SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}"
  !macroend

  !macro customHeader
    Function un.OneKeyRemoveAppData
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
      ShowWindow $HWNDPARENT ${SW_SHOW}
      Abort
    ${EndIf}
    ${If} $OneKeyModernWasInstalled == "1"
    ${AndIf} $OneKeyModernHadPerUser != $OneKeyModernHadPerMachine
      ShowWindow $HWNDPARENT ${SW_SHOW}
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

    ${If} $OneKeyModernAccepted == "1"
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

  # Embedded 7z extraction is cancellable because it only writes temporary
  # files. Lock cancellation before old-version removal and the final copy.
  !macro customInstallBeforeRemoveOldVersion
    ${If} $OneKeyModernUiActive == "1"
      !ifndef APP_BUILD_DIR
        !ifndef APP_PACKAGE_URL
          !ifndef ZIP_COMPRESSION
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

            Push $OUTDIR
            ClearErrors
            CreateDirectory "$PLUGINSDIR\7z-out"
            ${If} ${Errors}
              Pop $0
              SetOutPath $0
              nsis-duilib-ui::Shutdown
              Pop $0
              StrCpy $OneKeyModernUiActive "0"
              ShowWindow $HWNDPARENT ${SW_SHOW}
              Abort
            ${EndIf}
            # Nsis7z ignores extraction failures; the existing 7za helper reports
            # CRC and write errors before any old-version files are removed.
            nsExec::ExecToStack '"$PLUGINSDIR\onekey-7za.exe" x -y -o"$PLUGINSDIR\7z-out" "$PLUGINSDIR\app-$OneKeyModernPackageArch.7z"'
            Pop $OneKeyModernResult
            Pop $0
            Pop $0
            SetOutPath $0
            ${If} $OneKeyModernResult != "0"
              nsis-duilib-ui::Shutdown
              Pop $0
              StrCpy $OneKeyModernUiActive "0"
              ShowWindow $HWNDPARENT ${SW_SHOW}
              Abort
            ${EndIf}
            StrCpy $OneKeyModernPackagePrepared "1"
          !endif
        !endif
      !endif

    OneKeyModernPrepareCommit:
      nsis-duilib-ui::PrepareCommit
      Pop $OneKeyModernResult
      ${If} $OneKeyModernResult == "pending"
        Sleep 80
        Goto OneKeyModernPrepareCommit
      ${ElseIf} $OneKeyModernResult == "cancel"
        nsis-duilib-ui::ShutdownHidden
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        SetErrorLevel 1
        Quit
      ${ElseIf} $OneKeyModernResult != "ok"
        nsis-duilib-ui::Shutdown
        Pop $0
        StrCpy $OneKeyModernUiActive "0"
        ShowWindow $HWNDPARENT ${SW_SHOW}
        Abort
      ${EndIf}
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
      ${endIf}
    !endif

    WriteRegExpandStr SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegExpandStr SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}" "IconUri" "$INSTDIR\resources\windows\notificationIcon.png"

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
