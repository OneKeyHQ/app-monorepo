import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAppUpdateRoutes,
  EDAppConnectionModal,
  EModalReferFriendsRoutes,
  EModalRewardCenterRoutes,
  EModalRoutes,
  EModalSettingRoutes,
  EModalSignatureConfirmRoutes,
  EModalStakingRoutes,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ETestModalPages,
  EWebViewRoutes,
} from '@onekeyhq/shared/src/routes';
import {
  EActionCenterPages,
  EFullScreenPushRoutes,
} from '@onekeyhq/shared/src/routes/fullScreenPush';

export interface IRoutePathConfig {
  name: string;
  rewrite?: string;
  exact?: boolean;
  children?: IRoutePathConfig[];
}

const route = ({
  name,
  rewrite,
  exact,
  children,
}: IRoutePathConfig): IRoutePathConfig => ({
  name,
  ...(rewrite ? { rewrite } : {}),
  ...(exact ? { exact } : {}),
  ...(children ? { children } : {}),
});

const mainModalPathConfig = [
  route({
    name: EModalRewardCenterRoutes.RewardCenter,
    rewrite: '/reward-center',
    exact: true,
  }),
];

const settingPathConfig = [
  route({ name: EModalSettingRoutes.SettingListModal, rewrite: '/' }),
  route({
    name: EModalSettingRoutes.SettingProtectModal,
    rewrite: '/protection',
  }),
];

const appUpdatePathConfig = [
  route({
    name: EAppUpdateRoutes.UpdatePreview,
    rewrite: '/preview',
  }),
];

const stakingPathConfig = [
  route({
    name: EModalStakingRoutes.ProtocolDetails,
    rewrite: '/defi/staking/:symbol/:provider',
    exact: true,
  }),
  route({
    name: EModalStakingRoutes.ProtocolDetailsV2,
    rewrite: '/defi/staking/v2/:symbol/:provider',
    exact: true,
  }),
  route({
    name: EModalStakingRoutes.ProtocolDetailsV2Share,
    rewrite: '/defi/:network/:symbol/:provider',
    exact: true,
  }),
  route({ name: EModalStakingRoutes.ManagePosition, exact: true }),
];

// Ext standalone windows cold-start from the URL hash (see
// getStateFromPath.ext.ts), so every screen opened via ServiceDApp.openModal
// must be listed here, or the window resolves to NotFound.
// VerifyMessage is excluded: DAppConnectionRouter registers no screen for it,
// and a parsed route pointing at an unregistered screen creates navigation
// state the navigator cannot render.
const dAppConnectionPathConfig = Object.values(EDAppConnectionModal)
  .filter((name) => name !== EDAppConnectionModal.VerifyMessage)
  .map((name) => route({ name }));

const signatureConfirmPathConfig = [
  route({ name: EModalSignatureConfirmRoutes.TxConfirmFromDApp }),
  route({ name: EModalSignatureConfirmRoutes.MessageConfirmFromDApp }),
  route({ name: EModalSignatureConfirmRoutes.LnurlPayRequest }),
  route({ name: EModalSignatureConfirmRoutes.LnurlWithdraw }),
  route({ name: EModalSignatureConfirmRoutes.LnurlAuth }),
  route({ name: EModalSignatureConfirmRoutes.WeblnSendPayment }),
];

const onboardingV2PagePathConfig = [
  route({
    name: EOnboardingPagesV2.GetStarted,
    rewrite: '/get-started',
  }),
  route({
    name: EOnboardingPagesV2.CreateNewWallet,
    rewrite: '/create-new-wallet',
  }),
  route({
    name: EOnboardingPagesV2.CreateOrImportWallet,
    rewrite: '/create-or-import-wallet',
  }),
];

const modalRouteNames = Object.values(EModalRoutes).filter(
  (name) => name !== EModalRoutes.TestModal,
);

const modalRouteOverrides: Partial<Record<EModalRoutes, IRoutePathConfig>> = {
  [EModalRoutes.MainModal]: route({
    name: EModalRoutes.MainModal,
    children: mainModalPathConfig,
  }),
  [EModalRoutes.SettingModal]: route({
    name: EModalRoutes.SettingModal,
    rewrite: '/settings',
    exact: true,
    children: settingPathConfig,
  }),
  [EModalRoutes.AppUpdateModal]: route({
    name: EModalRoutes.AppUpdateModal,
    rewrite: '/update',
    children: appUpdatePathConfig,
  }),
  [EModalRoutes.StakingModal]: route({
    name: EModalRoutes.StakingModal,
    children: stakingPathConfig,
  }),
  [EModalRoutes.ReferFriendsModal]: route({
    name: EModalRoutes.ReferFriendsModal,
    children: [route({ name: EModalReferFriendsRoutes.ReferAFriend })],
  }),
  [EModalRoutes.DAppConnectionModal]: route({
    name: EModalRoutes.DAppConnectionModal,
    children: dAppConnectionPathConfig,
  }),
  [EModalRoutes.SignatureConfirmModal]: route({
    name: EModalRoutes.SignatureConfirmModal,
    children: signatureConfirmPathConfig,
  }),
};

export const modalRouterPathConfig: IRoutePathConfig[] = [
  ...modalRouteNames.map(
    (name) => modalRouteOverrides[name] ?? route({ name }),
  ),
  ...(platformEnv.isDev
    ? [
        route({
          name: EModalRoutes.TestModal,
          children: [route({ name: ETestModalPages.TestSimpleModal })],
        }),
      ]
    : []),
];

export const fullModalRouterPathConfig: IRoutePathConfig[] = [
  route({
    name: EModalRoutes.AppUpdateModal,
    children: appUpdatePathConfig,
  }),
  route({
    name: EModalRoutes.DAppConnectionModal,
    children: dAppConnectionPathConfig,
  }),
  route({ name: EModalRoutes.ReceiveModal }),
  route({ name: EModalRoutes.SendModal }),
  route({
    name: EModalRoutes.SignatureConfirmModal,
    children: signatureConfirmPathConfig,
  }),
];

export const fullScreenPushRouterPathConfig: IRoutePathConfig[] = [
  route({
    name: EFullScreenPushRoutes.ActionCenter,
    children: [route({ name: EActionCenterPages.ActionCenter })],
  }),
];

export const onboardingRouterV2PathConfig: IRoutePathConfig[] = [
  route({
    name: EOnboardingV2Routes.OnboardingV2,
    rewrite: '/onboarding',
    exact: true,
    children: onboardingV2PagePathConfig,
  }),
];

export const webViewRouterPathConfig: IRoutePathConfig[] = [
  route({
    name: EWebViewRoutes.WebView,
    children: [route({ name: EWebViewRoutes.WebView })],
  }),
];
