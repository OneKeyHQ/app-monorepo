import {
  StackNavigationOptions,
  TransitionPresets,
} from '@react-navigation/stack';
import { isNil } from 'lodash';

export { createStackNavigator as default } from '@react-navigation/stack';

export function buildModalStackNavigatorOptions({
  isVerticalLayout,
}: {
  isVerticalLayout?: boolean;
} = {}) {
  const options: StackNavigationOptions = {
    headerShown: false,
    ...TransitionPresets.SlideFromRightIOS,
  };
  if (!isNil(isVerticalLayout)) {
    options.animationEnabled = Boolean(isVerticalLayout);
  }
  return options;
}
