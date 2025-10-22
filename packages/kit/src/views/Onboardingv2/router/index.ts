import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

const GetStarted = LazyLoadPage(() => import('../pages/GetStarted'));
const AddExistingWallet = LazyLoadPage(
  () => import('../pages/AddExistingWallet'),
);
const ImportPhraseOrPrivateKey = LazyLoadPage(
  () => import('../pages/ImportPhraseOrPrivateKey'),
);
const FinalizeWalletSetup = LazyLoadPage(
  () => import('../pages/FinalizeWalletSetup'),
);
const PickYourDevice = LazyLoadPage(() => import('../pages/PickYourDevice'));

const ConnectYourDevice = LazyLoadPage(
  () => import('../pages/ConnectYourDevice'),
);

export const OnboardingRouterV2: IModalFlowNavigatorConfig<
  EOnboardingPagesV2,
  IOnboardingParamListV2
>[] = [
  {
    name: EOnboardingPagesV2.GetStarted,
    component: GetStarted,
  },
  {
    name: EOnboardingPagesV2.AddExistingWallet,
    component: AddExistingWallet,
  },
  {
    name: EOnboardingPagesV2.ImportPhraseOrPrivateKey,
    component: ImportPhraseOrPrivateKey,
  },
  {
    name: EOnboardingPagesV2.FinalizeWalletSetup,
    component: FinalizeWalletSetup,
  },
  {
    name: EOnboardingPagesV2.PickYourDevice,
    component: PickYourDevice,
  },
  {
    name: EOnboardingPagesV2.ConnectYourDevice,
    component: ConnectYourDevice,
  },
];
