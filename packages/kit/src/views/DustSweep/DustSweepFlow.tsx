import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import type { ComponentType } from 'react';

import {
  CommonActions,
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/core';

import { useTheme } from '@onekeyhq/components';
import {
  useIsOverlayPage,
  usePageType,
} from '@onekeyhq/components/src/hocs/PageType';
import {
  makeModalStackNavigatorOptions,
  makeTabScreenOptions,
} from '@onekeyhq/components/src/layouts/Navigation/GlobalScreenOptions';
import { NavBackButton } from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderBackButton';
import { createStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/StackNavigator';
import type {
  StackNavigationProp,
  StackScreenProps,
} from '@onekeyhq/components/src/layouts/Navigation/StackNavigator';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { DustSweepScreenProvider, useDustSweep } from './DustSweepProvider';

import type {
  NavigationAction,
  NavigationProp,
  ParamListBase,
} from '@react-navigation/core';

type IDustSweepFlowParams = {
  Selection: undefined;
  Execution: undefined;
};

const FlowStack = createStackNavigator<IDustSweepFlowParams>();
const FlowContext = createContext<
  | {
      component: ComponentType;
      exit: (action?: NavigationAction) => void;
    }
  | undefined
>(undefined);

export function useDustSweepFlow() {
  const context = useContext(FlowContext);
  if (!context) throw new OneKeyLocalError('DustSweepFlow is required');
  const navigation = useNavigation<StackNavigationProp<IDustSweepFlowParams>>();
  const route = useRoute<StackScreenProps<IDustSweepFlowParams>['route']>();
  const continueRemoval = useCallback(
    (action: NavigationAction) => {
      const stack = navigation.getState();
      // A local Back leaves the whole flow. Ancestor removal keeps its original
      // destination and React Navigation's visited-route guard metadata.
      let localAction = ['GO_BACK', 'POP', 'POP_TO_TOP'].includes(action.type);
      if (action.target) localAction = action.target === stack.key;
      else if (action.source)
        localAction = stack.routes.some((entry) => entry.key === action.source);
      context.exit(localAction ? undefined : action);
    },
    [context, navigation],
  );
  return { ...context, continueRemoval, execution: route.name === 'Execution' };
}

function DustSweepFlowScreen({
  navigation,
  route,
}: StackScreenProps<IDustSweepFlowParams>) {
  const model = useDustSweep();
  const focused = useIsFocused();
  const { component: Component } = useDustSweepFlow();
  const isFocused = focused && model.isFocused;
  const start = useCallback(() => {
    if (!isFocused || route.name !== 'Selection') return undefined;
    const sessionId = model.start();
    if (sessionId) navigation.push('Execution');
    return sessionId;
  }, [isFocused, model, navigation, route.name]);
  useEffect(() => {
    // Again (or a restored route with no in-memory session) only returns to
    // selection. Mounting a route never starts or resumes transaction work.
    if (route.name === 'Execution' && model.selecting) navigation.popToTop();
  }, [model.selecting, navigation, route.name]);
  const value = useMemo(
    () => ({ ...model, isFocused, start }),
    [model, isFocused, start],
  );
  return (
    <DustSweepScreenProvider value={value}>
      <Component />
    </DustSweepScreenProvider>
  );
}

export function DustSweepFlow({ component }: { component: ComponentType }) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const theme = useTheme();
  const overlay = useIsOverlayPage();
  const pageType = usePageType();
  const exit = useCallback(
    (action?: NavigationAction) => {
      navigation.dispatch(
        action ?? {
          ...CommonActions.goBack(),
          source: route.key,
        },
      );
    },
    [navigation, route.key],
  );
  const goBack = useCallback(() => exit(), [exit]);
  const renderBack = useCallback(
    () => <NavBackButton onPress={goBack} />,
    [goBack],
  );
  const value = useMemo(() => ({ component, exit }), [component, exit]);
  const screenOptions = useCallback(
    (optionsInfo: StackScreenProps<IDustSweepFlowParams>) => ({
      ...(overlay
        ? makeModalStackNavigatorOptions({
            optionsInfo,
            bgColor: theme.bgApp.val,
            titleColor: theme.text.val,
            pageType,
          })
        : makeTabScreenOptions({
            navigation: optionsInfo.navigation,
            bgColor: theme.bgApp.val,
            titleColor: theme.text.val,
          })),
      // This is a push inside the existing modal/tab, never a second modal.
      presentation: 'card' as const,
      freezeOnBlur: true,
      ...(!overlay && optionsInfo.route.name === 'Selection'
        ? { headerLeft: renderBack }
        : undefined),
    }),
    [overlay, pageType, renderBack, theme.bgApp.val, theme.text.val],
  );
  return (
    <FlowContext.Provider value={value}>
      <FlowStack.Navigator
        initialRouteName="Selection"
        screenOptions={screenOptions}
      >
        <FlowStack.Screen name="Selection" component={DustSweepFlowScreen} />
        <FlowStack.Screen name="Execution" component={DustSweepFlowScreen} />
      </FlowStack.Navigator>
    </FlowContext.Provider>
  );
}
