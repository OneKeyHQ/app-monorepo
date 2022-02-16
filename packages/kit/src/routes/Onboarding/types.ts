import type { NavigatorScreenParams } from '@react-navigation/native';

export enum OnboardingRoutes {
  Stack = 'OnboardingRoutesStack',
  Modal = 'OnboardingRoutesModal',
}

export enum OnboardingStackRoutes {
  Welcome = 'Welcome',
}

export enum OnboardingModalRoutes {
  SetPassword = 'SetPassword',
  Terms = 'Terms',
}

export type OnboardingRoutesParams = {
  [OnboardingRoutes.Stack]: undefined;
  [OnboardingRoutes.Modal]: NavigatorScreenParams<ModalRoutesParams>;
};

export type ModalRoutesParams = {
  [OnboardingModalRoutes.Terms]: undefined;
  [OnboardingModalRoutes.SetPassword]: undefined;
};
