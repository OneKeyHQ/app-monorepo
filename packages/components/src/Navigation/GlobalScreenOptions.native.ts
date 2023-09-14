import { buildModalOpenAnimationOptions } from '@onekeyhq/kit/src/routes/Root/Modal/buildModalStackNavigatorOptions';

export const makeRootScreenOptions = (isVerticalLayout: boolean) => {
  return {
    headerShown: false,
    animation: 'simple_push',
  };
};

export const makeModalScreenOptions = (isVerticalLayout: boolean) => {
  return {
    headerShown: false,
    presentation: 'modal',
    ...buildModalOpenAnimationOptions({ isVerticalLayout }),
  };
};

export const makeOnboardingScreenOptions = () => {
  return {
    presentation: 'fullScreenModal', // containedModal card fullScreenModal
    animation: 'fade',
  };
};
