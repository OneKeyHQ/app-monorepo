// Screens that pause Session Replay before their first frame.
//
// Read by the modal flow navigator, which wraps every matching screen in a
// pause token plus a native no-capture view. Being listed here is
// conservative: a screen that is not sensitive only loses recording. The kit
// route classifier remains the default-deny decision for everything else.

import { EAccountManagerStacksRoutes } from '../../routes/accountManagerStacks';
import { ECloudBackupRoutes } from '../../routes/cloudBackup';
import { EModalKeyTagRoutes } from '../../routes/keyTag';
import { EManualBackupRoutes } from '../../routes/manualBackup';
import { EModalRoutes } from '../../routes/modal';
import { EOnboardingPages } from '../../routes/onboarding';
import { EOnboardingPagesV2 } from '../../routes/onboardingv2';
import { EPrimePages } from '../../routes/prime';
import { ERootRoutes } from '../../routes/root';
import { EScanQrCodeModalPages } from '../../routes/scanQrCode';
import { EModalWalletConnectPayRoutes } from '../../routes/walletConnectPay';
import { EModalWebViewRoutes, EWebViewRoutes } from '../../routes/webView';

// Leaf screens that show or accept secrets: recovery phrases, private keys,
// PINs, passcodes, backups and the camera.
export const REPLAY_SENSITIVE_ROUTE_NAMES: ReadonlySet<string> =
  new Set<string>([
    EOnboardingPagesV2.ImportPhraseOrPrivateKey,
    EOnboardingPagesV2.SelectPrivateKeyNetwork,
    EOnboardingPagesV2.BackupWalletReminder,
    EOnboardingPagesV2.ShowRecoveryPhrase,
    EOnboardingPagesV2.VerifyRecoveryPhrase,
    EOnboardingPagesV2.ICloudBackupDetails,
    EOnboardingPagesV2.ImportKeyTag,
    EOnboardingPagesV2.KeyTagBackupDotMap,
    EOnboardingPagesV2.KeyTagEnterPhrase,
    EOnboardingPagesV2.CreatePin,
    EOnboardingPagesV2.ConfirmPin,
    EOnboardingPagesV2.VerifyPin,
    EOnboardingPagesV2.CreatePasscode,
    EOnboardingPages.BeforeShowRecoveryPhrase,
    EOnboardingPages.RecoveryPhrase,
    EOnboardingPages.VerifyRecoverPhrase,
    EOnboardingPages.ImportRecoveryPhrase,
    EOnboardingPages.ImportKeyTag,
    EOnboardingPages.ImportPrivateKey,
    EOnboardingPages.ImportCloudBackup,
    EManualBackupRoutes.ManualBackupSelectWallet,
    EAccountManagerStacksRoutes.ExportPrivateKeysPage,
    ECloudBackupRoutes.CloudBackupDetail,
    EPrimePages.PrimeTransfer,
    EPrimePages.PrimeTransferPreview,
    EModalKeyTagRoutes.BackupWallet,
    EScanQrCodeModalPages.ScanQrCodeStack,
  ]);

// Leaf screens that host third-party web content (KYC, payment, DApps).
export const REPLAY_THIRD_PARTY_WEBVIEW_ROUTE_NAMES: ReadonlySet<string> =
  new Set<string>([
    EModalWebViewRoutes.WebView,
    EWebViewRoutes.WebView,
    ERootRoutes.WebView,
    EModalWalletConnectPayRoutes.DataCollection,
  ]);

// Root modals whose every screen is treated as sensitive or third-party,
// mirroring the containers the kit route classifier blocks as a whole.
export const REPLAY_SENSITIVE_MODAL_NAMES: ReadonlySet<string> =
  new Set<string>([
    EModalRoutes.ManualBackupModal,
    EModalRoutes.CloudBackupModal,
    EModalRoutes.KeyTagModal,
    EModalRoutes.LiteCardModal,
    EModalRoutes.ScanQrCodeModal,
    EModalRoutes.PrimeModal,
    EModalRoutes.SettingModal,
    EModalRoutes.WebViewModal,
    EModalRoutes.WalletConnectPayModal,
    EModalRoutes.DAppConnectionModal,
    EModalRoutes.DiscoveryModal,
  ]);

export function isReplayBlockedRouteName(routeName: string): boolean {
  return (
    REPLAY_SENSITIVE_ROUTE_NAMES.has(routeName) ||
    REPLAY_THIRD_PARTY_WEBVIEW_ROUTE_NAMES.has(routeName)
  );
}

export function isReplaySensitiveScreen({
  routeName,
  navigatorName,
}: {
  routeName: string;
  navigatorName?: string;
}): boolean {
  return (
    isReplayBlockedRouteName(routeName) ||
    (!!navigatorName && REPLAY_SENSITIVE_MODAL_NAMES.has(navigatorName))
  );
}
