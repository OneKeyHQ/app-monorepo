!define ONEKEY_APP_USER_MODEL_ID "OneKey Wallet"
!define ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY "Software\Classes\AppUserModelId\${ONEKEY_APP_USER_MODEL_ID}"

!ifdef BUILD_UNINSTALLER
  !define /redef APP_PRODUCT_FILENAME "OneKey Wallet"
  Var onekeyUninstallWelcomeText
!endif

!macro customUnInit
  StrCpy $onekeyUninstallWelcomeText "This wizard will uninstall $(^NameDA) and permanently delete all local user data, including wallets and settings.$\r$\n$\r$\nMake sure you have backed up your recovery phrases or private keys before continuing.$\r$\n$\r$\nClick Next to continue."
  ${if} $LANGUAGE == ${LANG_SIMPCHINESE}
    StrCpy $onekeyUninstallWelcomeText "此向导将卸载 $(^NameDA)，并永久删除本地的所有用户数据，包括钱包和设置。$\r$\n$\r$\n继续前，请确保已备份助记词或私钥。$\r$\n$\r$\n点击“下一步”继续。"
  ${elseif} $LANGUAGE == ${LANG_TRADCHINESE}
    StrCpy $onekeyUninstallWelcomeText "此精靈將解除安裝 $(^NameDA)，並永久刪除本機的所有使用者資料，包括錢包和設定。$\r$\n$\r$\n繼續前，請確保已備份助記詞或私鑰。$\r$\n$\r$\n按一下「下一步」繼續。"
  ${elseif} $LANGUAGE == ${LANG_GERMAN}
    StrCpy $onekeyUninstallWelcomeText "Dieser Assistent deinstalliert $(^NameDA) und löscht alle lokalen Benutzerdaten, einschließlich Wallets und Einstellungen, dauerhaft.$\r$\n$\r$\nStellen Sie sicher, dass Sie Ihre Wiederherstellungsphrasen oder privaten Schlüssel gesichert haben, bevor Sie fortfahren.$\r$\n$\r$\nKlicken Sie auf „Weiter“, um fortzufahren."
  ${elseif} $LANGUAGE == ${LANG_FRENCH}
    StrCpy $onekeyUninstallWelcomeText "Cet assistant désinstallera $(^NameDA) et supprimera définitivement toutes les données utilisateur locales, y compris les portefeuilles et les paramètres.$\r$\n$\r$\nAssurez-vous d'avoir sauvegardé vos phrases de récupération ou vos clés privées avant de continuer.$\r$\n$\r$\nCliquez sur « Suivant » pour continuer."
  ${elseif} $LANGUAGE == ${LANG_SPANISHINTERNATIONAL}
    StrCpy $onekeyUninstallWelcomeText "Este asistente desinstalará $(^NameDA) y eliminará permanentemente todos los datos locales del usuario, incluidas las carteras y la configuración.$\r$\n$\r$\nAsegúrese de haber guardado una copia de sus frases de recuperación o claves privadas antes de continuar.$\r$\n$\r$\nHaga clic en «Siguiente» para continuar."
  ${elseif} $LANGUAGE == ${LANG_JAPANESE}
    StrCpy $onekeyUninstallWelcomeText "このウィザードは $(^NameDA) をアンインストールし、ウォレットや設定を含むすべてのローカルユーザーデータを完全に削除します。$\r$\n$\r$\n続行する前に、リカバリーフレーズまたは秘密鍵をバックアップしたことを確認してください。$\r$\n$\r$\n「次へ」をクリックして続行してください。"
  ${elseif} $LANGUAGE == ${LANG_KOREAN}
    StrCpy $onekeyUninstallWelcomeText "이 마법사는 $(^NameDA)을(를) 제거하고 지갑 및 설정을 포함한 모든 로컬 사용자 데이터를 영구적으로 삭제합니다.$\r$\n$\r$\n계속하기 전에 복구 구문 또는 개인 키를 백업했는지 확인하세요.$\r$\n$\r$\n계속하려면 '다음'을 클릭하세요."
  ${elseif} $LANGUAGE == ${LANG_ITALIAN}
    StrCpy $onekeyUninstallWelcomeText "Questa procedura guidata disinstallerà $(^NameDA) ed eliminerà definitivamente tutti i dati utente locali, inclusi i portafogli e le impostazioni.$\r$\n$\r$\nPrima di continuare, assicurati di aver eseguito il backup delle frasi di recupero o delle chiavi private.$\r$\n$\r$\nFai clic su «Avanti» per continuare."
  ${elseif} $LANGUAGE == ${LANG_DUTCH}
    StrCpy $onekeyUninstallWelcomeText "Deze wizard verwijdert $(^NameDA) en wist alle lokale gebruikersgegevens permanent, inclusief wallets en instellingen.$\r$\n$\r$\nZorg dat u een back-up van uw herstelzinnen of privésleutels hebt gemaakt voordat u doorgaat.$\r$\n$\r$\nKlik op 'Volgende' om door te gaan."
  ${elseif} $LANGUAGE == ${LANG_DANISH}
    StrCpy $onekeyUninstallWelcomeText "Denne guide afinstallerer $(^NameDA) og sletter alle lokale brugerdata permanent, herunder wallets og indstillinger.$\r$\n$\r$\nSørg for, at du har sikkerhedskopieret dine gendannelsesfraser eller private nøgler, før du fortsætter.$\r$\n$\r$\nKlik på 'Næste' for at fortsætte."
  ${elseif} $LANGUAGE == ${LANG_SWEDISH}
    StrCpy $onekeyUninstallWelcomeText "Den här guiden avinstallerar $(^NameDA) och raderar alla lokala användardata permanent, inklusive plånböcker och inställningar.$\r$\n$\r$\nSe till att du har säkerhetskopierat dina återställningsfraser eller privata nycklar innan du fortsätter.$\r$\n$\r$\nKlicka på 'Nästa' för att fortsätta."
  ${elseif} $LANGUAGE == ${LANG_NORWEGIAN}
    StrCpy $onekeyUninstallWelcomeText "Denne veiviseren avinstallerer $(^NameDA) og sletter alle lokale brukerdata permanent, inkludert lommebøker og innstillinger.$\r$\n$\r$\nSørg for at du har sikkerhetskopiert gjenopprettingsfrasene eller de private nøklene dine før du fortsetter.$\r$\n$\r$\nKlikk på 'Neste' for å fortsette."
  ${elseif} $LANGUAGE == ${LANG_FINNISH}
    StrCpy $onekeyUninstallWelcomeText "Tämä ohjattu toiminto poistaa $(^NameDA)-sovelluksen ja kaikki paikalliset käyttäjätiedot pysyvästi, mukaan lukien lompakot ja asetukset.$\r$\n$\r$\nVarmista ennen jatkamista, että olet varmuuskopioinut palautuslauseesi tai yksityiset avaimesi.$\r$\n$\r$\nJatka napsauttamalla Seuraava."
  ${elseif} $LANGUAGE == ${LANG_RUSSIAN}
    StrCpy $onekeyUninstallWelcomeText "Этот мастер удалит $(^NameDA) и безвозвратно удалит все локальные данные пользователя, включая кошельки и настройки.$\r$\n$\r$\nПеред продолжением убедитесь, что вы сохранили резервную копию фраз восстановления или приватных ключей.$\r$\n$\r$\nНажмите «Далее», чтобы продолжить."
  ${elseif} $LANGUAGE == ${LANG_PORTUGUESE}
    StrCpy $onekeyUninstallWelcomeText "Este assistente irá desinstalar $(^NameDA) e eliminar permanentemente todos os dados locais do utilizador, incluindo carteiras e definições.$\r$\n$\r$\nAntes de continuar, certifique-se de que fez uma cópia de segurança das suas frases de recuperação ou chaves privadas.$\r$\n$\r$\nClique em «Seguinte» para continuar."
  ${elseif} $LANGUAGE == ${LANG_PORTUGUESEBR}
    StrCpy $onekeyUninstallWelcomeText "Este assistente desinstalará $(^NameDA) e excluirá permanentemente todos os dados locais do usuário, incluindo carteiras e configurações.$\r$\n$\r$\nAntes de continuar, certifique-se de ter feito um backup das suas frases de recuperação ou chaves privadas.$\r$\n$\r$\nClique em 'Próximo' para continuar."
  ${elseif} $LANGUAGE == ${LANG_POLISH}
    StrCpy $onekeyUninstallWelcomeText "Ten kreator odinstaluje $(^NameDA) i trwale usunie wszystkie lokalne dane użytkownika, w tym portfele i ustawienia.$\r$\n$\r$\nPrzed kontynuowaniem upewnij się, że masz kopię zapasową fraz odzyskiwania lub kluczy prywatnych.$\r$\n$\r$\nKliknij „Dalej”, aby kontynuować."
  ${elseif} $LANGUAGE == ${LANG_UKRAINIAN}
    StrCpy $onekeyUninstallWelcomeText "Цей майстер видалить $(^NameDA) і назавжди видалить усі локальні дані користувача, зокрема гаманці та налаштування.$\r$\n$\r$\nПерш ніж продовжити, переконайтеся, що ви створили резервну копію фраз відновлення або приватних ключів.$\r$\n$\r$\nНатисніть «Далі», щоб продовжити."
  ${elseif} $LANGUAGE == ${LANG_CZECH}
    StrCpy $onekeyUninstallWelcomeText "Tento průvodce odinstaluje $(^NameDA) a trvale odstraní všechna místní uživatelská data, včetně peněženek a nastavení.$\r$\n$\r$\nNež budete pokračovat, ujistěte se, že máte zálohované fráze pro obnovení nebo soukromé klíče.$\r$\n$\r$\nPokračujte kliknutím na tlačítko „Další“."
  ${elseif} $LANGUAGE == ${LANG_SLOVAK}
    StrCpy $onekeyUninstallWelcomeText "Tento sprievodca odinštaluje $(^NameDA) a natrvalo odstráni všetky miestne používateľské údaje vrátane peňaženiek a nastavení.$\r$\n$\r$\nPred pokračovaním sa uistite, že máte zálohované frázy na obnovenie alebo súkromné kľúče.$\r$\n$\r$\nPokračujte kliknutím na tlačidlo „Ďalej“."
  ${elseif} $LANGUAGE == ${LANG_HUNGARIAN}
    StrCpy $onekeyUninstallWelcomeText "Ez a varázsló eltávolítja a(z) $(^NameDA) alkalmazást, és véglegesen törli az összes helyi felhasználói adatot, beleértve a tárcákat és a beállításokat.$\r$\n$\r$\nA folytatás előtt győződjön meg arról, hogy biztonsági másolatot készített a helyreállítási kifejezésekről vagy a privát kulcsokról.$\r$\n$\r$\nA folytatáshoz kattintson a „Tovább” gombra."
  ${elseif} $LANGUAGE == ${LANG_ARABIC}
    StrCpy $onekeyUninstallWelcomeText "سيزيل هذا المعالج $(^NameDA) ويحذف جميع بيانات المستخدم المحلية نهائياً، بما في ذلك المحافظ والإعدادات.$\r$\n$\r$\nقبل المتابعة، تأكد من الاحتفاظ بنسخة احتياطية من عبارات الاسترداد أو المفاتيح الخاصة.$\r$\n$\r$\nانقر على «التالي» للمتابعة."
  ${elseif} $LANGUAGE == ${LANG_TURKISH}
    StrCpy $onekeyUninstallWelcomeText "Bu sihirbaz $(^NameDA) uygulamasını kaldıracak ve cüzdanlar ile ayarlar dahil tüm yerel kullanıcı verilerini kalıcı olarak silecektir.$\r$\n$\r$\nDevam etmeden önce kurtarma ifadelerinizi veya özel anahtarlarınızı yedeklediğinizden emin olun.$\r$\n$\r$\nDevam etmek için 'İleri'ye tıklayın."
  ${elseif} $LANGUAGE == ${LANG_THAI}
    StrCpy $onekeyUninstallWelcomeText "ตัวช่วยนี้จะถอนการติดตั้ง $(^NameDA) และลบข้อมูลผู้ใช้ทั้งหมดที่จัดเก็บในเครื่องอย่างถาวร รวมถึงกระเป๋าเงินและการตั้งค่า$\r$\n$\r$\nก่อนดำเนินการต่อ โปรดตรวจสอบว่าคุณได้สำรองวลีการกู้คืนหรือคีย์ส่วนตัวแล้ว$\r$\n$\r$\nคลิก 'ถัดไป' เพื่อดำเนินการต่อ"
  ${elseif} $LANGUAGE == ${LANG_VIETNAMESE}
    StrCpy $onekeyUninstallWelcomeText "Trình hướng dẫn này sẽ gỡ cài đặt $(^NameDA) và xóa vĩnh viễn tất cả dữ liệu người dùng trên máy, bao gồm ví và cài đặt.$\r$\n$\r$\nTrước khi tiếp tục, hãy đảm bảo bạn đã sao lưu cụm từ khôi phục hoặc khóa riêng tư.$\r$\n$\r$\nNhấp vào 'Tiếp' để tiếp tục."
  ${endif}
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TEXT "$onekeyUninstallWelcomeText"
  !insertmacro MUI_UNPAGE_WELCOME
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
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "${ONEKEY_NOTIFICATION_IDENTITY_REGISTRY_KEY}"
!macroend
