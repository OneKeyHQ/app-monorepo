import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

const GetStarted = LazyLoadPage(() => import('../pages/GetStarted'));
const AddExistingWallet = LazyLoadPage(
  () => import('../pages/AddExistingWallet'),
);
const CreateOrImportWallet = LazyLoadPage(
  () => import('../pages/CreateOrImportWallet'),
);
const FinalizeWalletSetup = LazyLoadPage(
  () => import('../pages/FinalizeWalletSetup'),
);
const PickYourDevice = LazyLoadPage(() => import('../pages/PickYourDevice'));
const ImportPhraseOrPrivateKey = LazyLoadPage(
  () => import('../pages/ImportPhraseOrPrivateKey'),
);
const BackupWalletReminder = LazyLoadPage(
  () => import('../pages/BackupWalletReminder'),
);
const ShowRecoveryPhrase = LazyLoadPage(
  () => import('../pages/ShowRecoveryPhrase'),
);
const VerifyRecoveryPhrase = LazyLoadPage(
  () => import('../pages/VerifyRecoveryPhrase'),
);
const SelectPrivateKeyNetwork = LazyLoadPage(
  () => import('../pages/SelectPrivateKeyNetwork'),
);
const ConnectYourDevice = LazyLoadPage(
  () => import('../pages/ConnectYourDevice'),
);
const ConnectQRCode = LazyLoadPage(() => import('../pages/ConnectQRCode'));
const CheckAndUpdate = LazyLoadPage(() => import('../pages/CheckAndUpdate'));
const ICloudBackup = LazyLoadPage(() => import('../pages/ICloudBackup'));
const ICloudBackupDetails = LazyLoadPage(
  () => import('../pages/ICloudBackupDetails'),
);
const ConnectWalletSelectNetworks = LazyLoadPage(
  () => import('../pages/ConnectWalletSelectNetworks'),
);
const ConnectExternalWallet = LazyLoadPage(
  () => import('../pages/ConnectExternalWallet'),
);
const ImportKeyTag = LazyLoadPage(() => import('../pages/ImportKeyTag'));

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
];
