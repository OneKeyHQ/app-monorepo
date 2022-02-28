import { CreateWalletRoutesParams } from '../Modal/CreateWallet';

import type { NavigatorScreenParams } from '@react-navigation/native';

export enum OnboardingRoutes {
  Stack = 'OnboardingRoutesStack',
  Modal = 'OnboardingRoutesModal',
}

export enum OnboardingStackRoutes {
  Welcome = 'Welcome',
  Webview = 'Webview',
}

export type StackRoutesParams = {
  [OnboardingStackRoutes.Welcome]: undefined;
  [OnboardingStackRoutes.Webview]: { url: string; title?: string };
};

export type OnboardingRoutesParams = {
  [OnboardingRoutes.Stack]: NavigatorScreenParams<StackRoutesParams>;
  [OnboardingRoutes.Modal]: NavigatorScreenParams<CreateWalletRoutesParams>;
};
