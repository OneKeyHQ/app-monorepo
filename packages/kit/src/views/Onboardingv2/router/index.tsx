import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  onboardingV2RouteConfig,
} from '@onekeyhq/shared/src/routes';

import { OnboardingPageFallback } from '../components/Layout';
import { OnboardingLayoutFallback } from '../components/OnboardingLayout';

// Keep the Suspense fallback aligned with the page shell so lazy-loaded pages
// do not briefly flash the legacy onboarding frame during navigation.
const pageFallback = <OnboardingPageFallback />;
const legacyLayoutFallback = <OnboardingLayoutFallback />;

const GetStarted = LazyLoadPage(
  () => import('../pages/GetStarted'),
  undefined,
  false,
  pageFallback,
);
const CreateNewWallet = LazyLoadPage(
  () => import('../pages/CreateNewWallet'),
  undefined,
  false,
  pageFallback,
);
const CreateOrImportWallet = LazyLoadPage(
  () => import('../pages/CreateOrImportWallet'),
  undefined,
  false,
  pageFallback,
);
const FinalizeWalletSetup = LazyLoadPage(
  () => import('../pages/FinalizeWalletSetup'),
  undefined,
  false,
  pageFallback,
);
const PickYourDevice = LazyLoadPage(
  () => import('../pages/PickYourDevice'),
  undefined,
  false,
  pageFallback,
);
const ImportPhraseOrPrivateKey = LazyLoadPage(
  () => import('../pages/ImportPhraseOrPrivateKey'),
  undefined,
  false,
  pageFallback,
);
const ImportWatchedAccount = LazyLoadPage(
  () => import('../pages/ImportWatchedAccountV2'),
  undefined,
  false,
  legacyLayoutFallback,
);
const BackupWalletReminder = LazyLoadPage(
  () => import('../pages/BackupWalletReminder'),
  undefined,
  false,
  pageFallback,
);
const ShowRecoveryPhrase = LazyLoadPage(
  () => import('../pages/ShowRecoveryPhrase'),
  undefined,
  false,
  legacyLayoutFallback,
);
const VerifyRecoveryPhrase = LazyLoadPage(
  () => import('../pages/VerifyRecoveryPhrase'),
  undefined,
  false,
  legacyLayoutFallback,
);
const SelectPrivateKeyNetwork = LazyLoadPage(
  () => import('../pages/SelectPrivateKeyNetwork'),
  undefined,
  false,
  pageFallback,
);
const ConnectYourDevice = LazyLoadPage(
  () => import('../pages/ConnectYourDevice'),
  undefined,
  false,
  pageFallback,
);
const ConnectQRCode = LazyLoadPage(
  () => import('../pages/ConnectQRCode'),
  undefined,
  false,
  pageFallback,
);
const CheckAndUpdate = LazyLoadPage(
  () => import('../pages/CheckAndUpdate'),
  undefined,
  false,
  pageFallback,
);
const ICloudBackup = LazyLoadPage(
  () => import('../pages/ICloudBackup'),
  undefined,
  false,
  pageFallback,
);
const ICloudBackupDetails = LazyLoadPage(
  () => import('../pages/ICloudBackupDetails'),
  undefined,
  false,
  pageFallback,
);
const ConnectWalletSelectNetworks = LazyLoadPage(
  () => import('../pages/ConnectWalletSelectNetworks'),
  undefined,
  false,
  legacyLayoutFallback,
);
const ConnectExternalWallet = LazyLoadPage(
  () => import('../pages/ConnectExternalWallet'),
  undefined,
  false,
  legacyLayoutFallback,
);
const ImportKeyTag = LazyLoadPage(
  () => import('../pages/ImportKeyTag'),
  undefined,
  false,
  legacyLayoutFallback,
);
const OneKeyIDLogin = LazyLoadPage(
  () => import('../pages/OneKeyIDLoginPage'),
  undefined,
  false,
  pageFallback,
);
const CreatePin = LazyLoadPage(
  () => import('../pages/CreatePinPage'),
  undefined,
  false,
  pageFallback,
);
const ConfirmPin = LazyLoadPage(
  () => import('../pages/ConfirmPinPage'),
  undefined,
  false,
  pageFallback,
);
const CreatePasscode = LazyLoadPage(
  () => import('../pages/CreatePasscodePage'),
  undefined,
  false,
  pageFallback,
);
const VerifyPin = LazyLoadPage(
  () => import('../pages/VerifyPinPage'),
  undefined,
  false,
  pageFallback,
);
const ResetPinGuidePage = LazyLoadPage(
  () => import('../pages/ResetPinGuidePage'),
  undefined,
  false,
  pageFallback,
);
const NewPinCreated = LazyLoadPage(
  () => import('../pages/NewPinCreatedPage'),
  undefined,
  false,
  pageFallback,
);

const hiddenHeaderOptions = {
  headerShown: false,
};
// iOS 26: show the native nav bar from the first frame so the OnboardingPage
// shell renders its Liquid Glass header without the bar animating in. Other
// platforms / iOS < 26 keep the self-drawn LayoutHeader (headerShown: false).
const nativeHeaderOptions = {
  headerShown: platformEnv.isNativeIOS26Plus,
};

type IOnboardingScreenComponent = IModalFlowNavigatorConfig<
  EOnboardingPagesV2,
  IOnboardingParamListV2
>['component'];

const onboardingScreenComponents = {
  [EOnboardingPagesV2.GetStarted]: GetStarted,
  [EOnboardingPagesV2.CreateNewWallet]: CreateNewWallet,
  [EOnboardingPagesV2.CreateOrImportWallet]: CreateOrImportWallet,
  [EOnboardingPagesV2.FinalizeWalletSetup]: FinalizeWalletSetup,
  [EOnboardingPagesV2.PickYourDevice]: PickYourDevice,
  [EOnboardingPagesV2.ConnectYourDevice]: ConnectYourDevice,
  [EOnboardingPagesV2.ConnectQRCode]: ConnectQRCode,
  [EOnboardingPagesV2.CheckAndUpdate]: CheckAndUpdate,
  [EOnboardingPagesV2.ImportPhraseOrPrivateKey]: ImportPhraseOrPrivateKey,
  [EOnboardingPagesV2.ImportWatchedAccount]: ImportWatchedAccount,
  [EOnboardingPagesV2.BackupWalletReminder]: BackupWalletReminder,
  [EOnboardingPagesV2.ShowRecoveryPhrase]: ShowRecoveryPhrase,
  [EOnboardingPagesV2.VerifyRecoveryPhrase]: VerifyRecoveryPhrase,
  [EOnboardingPagesV2.SelectPrivateKeyNetwork]: SelectPrivateKeyNetwork,
  [EOnboardingPagesV2.ICloudBackup]: ICloudBackup,
  [EOnboardingPagesV2.ICloudBackupDetails]: ICloudBackupDetails,
  [EOnboardingPagesV2.ConnectWalletSelectNetworks]: ConnectWalletSelectNetworks,
  [EOnboardingPagesV2.ConnectExternalWallet]: ConnectExternalWallet,
  [EOnboardingPagesV2.ImportKeyTag]: ImportKeyTag,
  [EOnboardingPagesV2.OneKeyIDLogin]: OneKeyIDLogin,
  [EOnboardingPagesV2.CreatePin]: CreatePin,
  [EOnboardingPagesV2.ConfirmPin]: ConfirmPin,
  [EOnboardingPagesV2.CreatePasscode]: CreatePasscode,
  [EOnboardingPagesV2.VerifyPin]: VerifyPin,
  [EOnboardingPagesV2.ResetPinGuide]: ResetPinGuidePage,
  [EOnboardingPagesV2.NewPinCreated]: NewPinCreated,
} satisfies Record<EOnboardingPagesV2, IOnboardingScreenComponent>;

export const OnboardingRouterV2: IModalFlowNavigatorConfig<
  EOnboardingPagesV2,
  IOnboardingParamListV2
>[] = onboardingV2RouteConfig.children.map((screen) => ({
  name: screen.name,
  ...(screen.rewrite ? { rewrite: screen.rewrite } : {}),
  component: onboardingScreenComponents[screen.name],
  // Every onboarding screen hosts a native (iOS 26 Liquid Glass) header,
  // except FinalizeWalletSetup, which keeps its self-drawn hidden header.
  options:
    screen.name === EOnboardingPagesV2.FinalizeWalletSetup
      ? hiddenHeaderOptions
      : nativeHeaderOptions,
}));
