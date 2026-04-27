import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

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
const KeylessWalletRecovery = LazyLoadPage(
  () => import('../pages/KeylessWalletRecovery'),
  undefined,
  false,
  legacyLayoutFallback,
);
const KeylessWalletCreation = LazyLoadPage(
  () => import('../pages/KeylessWalletCreation'),
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
export const OnboardingRouterV2: IModalFlowNavigatorConfig<
  EOnboardingPagesV2,
  IOnboardingParamListV2
>[] = [
  {
    name: EOnboardingPagesV2.GetStarted,
    component: GetStarted,
    options: hiddenHeaderOptions,
    rewrite: '/get-started',
  },
  {
    name: EOnboardingPagesV2.CreateNewWallet,
    component: CreateNewWallet,
    options: hiddenHeaderOptions,
    rewrite: '/create-new-wallet',
  },
  {
    name: EOnboardingPagesV2.CreateOrImportWallet,
    component: CreateOrImportWallet,
    options: hiddenHeaderOptions,
    rewrite: '/create-or-import-wallet',
  },
  {
    name: EOnboardingPagesV2.FinalizeWalletSetup,
    component: FinalizeWalletSetup,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.PickYourDevice,
    component: PickYourDevice,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ConnectYourDevice,
    component: ConnectYourDevice,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ConnectQRCode,
    component: ConnectQRCode,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.CheckAndUpdate,
    component: CheckAndUpdate,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ImportPhraseOrPrivateKey,
    component: ImportPhraseOrPrivateKey,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ImportWatchedAccount,
    component: ImportWatchedAccount,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.BackupWalletReminder,
    component: BackupWalletReminder,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ShowRecoveryPhrase,
    component: ShowRecoveryPhrase,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.VerifyRecoveryPhrase,
    component: VerifyRecoveryPhrase,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.SelectPrivateKeyNetwork,
    component: SelectPrivateKeyNetwork,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ICloudBackup,
    component: ICloudBackup,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ICloudBackupDetails,
    component: ICloudBackupDetails,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ConnectWalletSelectNetworks,
    component: ConnectWalletSelectNetworks,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ConnectExternalWallet,
    component: ConnectExternalWallet,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ImportKeyTag,
    component: ImportKeyTag,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.KeylessWalletRecovery,
    component: KeylessWalletRecovery,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.KeylessWalletCreation,
    component: KeylessWalletCreation,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.OneKeyIDLogin,
    component: OneKeyIDLogin,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.CreatePin,
    component: CreatePin,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ConfirmPin,
    component: ConfirmPin,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.CreatePasscode,
    component: CreatePasscode,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.VerifyPin,
    component: VerifyPin,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.ResetPinGuide,
    component: ResetPinGuidePage,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.NewPinCreated,
    component: NewPinCreated,
    options: hiddenHeaderOptions,
  },
];
