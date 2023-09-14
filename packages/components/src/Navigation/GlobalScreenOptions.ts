import { TransitionPresets } from '@react-navigation/stack';
import { buildModalOpenAnimationOptions } from './buildModalStackNavigatorOptions';

export const makeRootScreenOptions = (isVerticalLayout: boolean) => {
  return {
    headerShown: false,
    ...(isVerticalLayout
      ? TransitionPresets.ScaleFromCenterAndroid
      : TransitionPresets.FadeFromBottomAndroid),
  };
};

export const makeModalScreenOptions = (isVerticalLayout: boolean) => {
  return {
    headerShown: false,
    presentation: 'transparentModal',
    ...buildModalOpenAnimationOptions({ isVerticalLayout }),
  };
};

export const makeOnboardingScreenOptions = () => {
  return {
    presentation: 'modal', // containedModal card fullScreenModal
    ...TransitionPresets.FadeFromBottomAndroid,
  };
};
