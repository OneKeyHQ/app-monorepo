import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import { OnboardingLayoutFallback } from '../components/OnboardingLayout';

const GetStarted = LazyLoadPage(
  () => import('../pages/GetStarted'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const AddExistingWallet = LazyLoadPage(
  () => import('../pages/AddExistingWallet'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const CreateOrImportWallet = LazyLoadPage(
  () => import('../pages/CreateOrImportWallet'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const FinalizeWalletSetup = LazyLoadPage(
  () => import('../pages/FinalizeWalletSetup'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const PickYourDevice = LazyLoadPage(
  () => import('../pages/PickYourDevice'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const ImportPhraseOrPrivateKey = LazyLoadPage(
  () => import('../pages/ImportPhraseOrPrivateKey'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const ImportWatchedAccount = LazyLoadPage(
  () => import('../pages/ImportWatchedAccountV2'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const BackupWalletReminder = LazyLoadPage(
  () => import('../pages/BackupWalletReminder'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const ShowRecoveryPhrase = LazyLoadPage(
  () => import('../pages/ShowRecoveryPhrase'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const VerifyRecoveryPhrase = LazyLoadPage(
  () => import('../pages/VerifyRecoveryPhrase'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const SelectPrivateKeyNetwork = LazyLoadPage(
  () => import('../pages/SelectPrivateKeyNetwork'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const ConnectYourDevice = LazyLoadPage(
  () => import('../pages/ConnectYourDevice'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const ConnectQRCode = LazyLoadPage(
  () => import('../pages/ConnectQRCode'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const CheckAndUpdate = LazyLoadPage(
  () => import('../pages/CheckAndUpdate'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const ICloudBackup = LazyLoadPage(
  () => import('../pages/ICloudBackup'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const ICloudBackupDetails = LazyLoadPage(
  () => import('../pages/ICloudBackupDetails'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const ConnectWalletSelectNetworks = LazyLoadPage(
  () => import('../pages/ConnectWalletSelectNetworks'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const ConnectExternalWallet = LazyLoadPage(
  () => import('../pages/ConnectExternalWallet'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const ImportKeyTag = LazyLoadPage(
  () => import('../pages/ImportKeyTag'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const KeylessWalletRecovery = LazyLoadPage(
  () => import('../pages/KeylessWalletRecovery'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);
const KeylessWalletCreation = LazyLoadPage(
  () => import('../pages/KeylessWalletCreation'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);

const MoreAction = LazyLoadPage(
  () => import('../pages/MoreAction'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
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
    name: EOnboardingPagesV2.AddExistingWallet,
    component: AddExistingWallet,
    options: hiddenHeaderOptions,
  },
  {
    name: EOnboardingPagesV2.CreateOrImportWallet,
    component: CreateOrImportWallet,
    options: hiddenHeaderOptions,
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
    name: EOnboardingPagesV2.MoreAction,
    component: MoreAction,
    options: hiddenHeaderOptions,
  },
];
