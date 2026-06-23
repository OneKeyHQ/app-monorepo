import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import BackupWalletReminder from '../pages/BackupWalletReminder';
import CheckAndUpdate from '../pages/CheckAndUpdate';
import ConfirmPin from '../pages/ConfirmPinPage';
import ConnectExternalWallet from '../pages/ConnectExternalWallet';
import ConnectQRCode from '../pages/ConnectQRCode';
import ConnectWalletSelectNetworks from '../pages/ConnectWalletSelectNetworks';
import { ConnectYourDevice } from '../pages/ConnectYourDevice';
import CreateNewWallet from '../pages/CreateNewWallet';
import CreateOrImportWallet from '../pages/CreateOrImportWallet';
import CreatePasscode from '../pages/CreatePasscodePage';
import CreatePin from '../pages/CreatePinPage';
import { FinalizeWalletSetup } from '../pages/FinalizeWalletSetup';
import GetStarted from '../pages/GetStarted';
import ICloudBackup from '../pages/ICloudBackup';
import ICloudBackupDetails from '../pages/ICloudBackupDetails';
import { ImportKeyTag } from '../pages/ImportKeyTag';
import ImportPhraseOrPrivateKey from '../pages/ImportPhraseOrPrivateKey';
import ImportWatchedAccount from '../pages/ImportWatchedAccountV2';
import NewPinCreated from '../pages/NewPinCreatedPage';
import OneKeyIDLogin from '../pages/OneKeyIDLoginPage';
import PickYourDevice from '../pages/PickYourDevice';
import ResetPinGuidePage from '../pages/ResetPinGuidePage';
import SelectPrivateKeyNetwork from '../pages/SelectPrivateKeyNetwork';
import ShowRecoveryPhrase from '../pages/ShowRecoveryPhrase';
import VerifyPin from '../pages/VerifyPinPage';
import VerifyRecoveryPhrase from '../pages/VerifyRecoveryPhrase';

const hiddenHeaderOptions = {
  headerShown: false,
};

// Web/Desktop/Extension override: pages are imported eagerly (not via
// React.lazy / LazyLoadPage) so every navigation inside the onboarding flow
// renders without a Suspense fallback flash — the visible problem on web
// caused by the modal's enter animation amplifying React.lazy's microtask
// boundary. The 28 page modules join the chunk that loads when the
// onboarding modal opens; the one-time cost is hidden by the modal's
// opening transition.
//
// Native (iOS / Android) uses the default lazy version in `./index.tsx` —
// no enter animation to amplify the lazy boundary, and lazy keeps the
// module count out of the cold-start startup graph (mobile budget check).
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
