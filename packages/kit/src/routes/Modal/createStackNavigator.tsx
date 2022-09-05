import { TransitionPresets } from '@react-navigation/stack';
import { isNil } from 'lodash';

export { createStackNavigator as default } from '@react-navigation/stack';

export function buildModalStackNavigatorOptions({
  isVerticalLayout,
}: {
  isVerticalLayout?: boolean;
} = {}) {
  return {
    headerShown: false,
    animationEnabled: isNil(isVerticalLayout) ? true : !!isVerticalLayout,
    ...TransitionPresets.SlideFromRightIOS,
  };
}
