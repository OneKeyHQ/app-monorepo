/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-shadow */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable default-case */
import { MissingIcon } from '@react-navigation/elements';
import {
  CommonActions,
  NavigationContext,
  NavigationRouteContext,
  ParamListBase,
  TabNavigationState,
  useLinkBuilder,
  useTheme,
} from '@react-navigation/native';
import React from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { EdgeInsets, useSafeAreaFrame } from 'react-native-safe-area-context';

import Box from '../../../Box';
import { DeviceState } from '../../../Provider/device';
import { useUserDevice, useThemeValue } from '../../../Provider/hooks';

import type { BottomTabBarProps, BottomTabDescriptorMap } from '../../types';
import BottomTabBarHeightCallbackContext from '../../utils/BottomTabBarHeightCallbackContext';
import useIsKeyboardShown from '../../utils/useIsKeyboardShown';
import BottomTabItem from '../BottomTabItem';

type Props = BottomTabBarProps & {
  style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
};

const DEFAULT_TABBAR_HEIGHT = 49;
const COMPACT_TABBAR_HEIGHT = 32;

const useNativeDriver = Platform.OS !== 'web';

type Options = {
  state: TabNavigationState<ParamListBase>;
  descriptors: BottomTabDescriptorMap;
  layout: { height: number; width: number };
  dimensions: { height: number; width: number };
  deviceSize: DeviceState['size'];
};

const shouldUseHorizontalLabels = ({
  state,
  descriptors,
  deviceSize,
}: Options) => {
  const { tabBarLabelPosition } =
    descriptors[state.routes[state.index].key].options;

  if (tabBarLabelPosition) {
    switch (tabBarLabelPosition) {
      case 'beside-icon':
        return true;
      case 'below-icon':
        return false;
    }
  }

  return !!['NORMAL'].includes(deviceSize);
};

const getPaddingBottom = (insets: EdgeInsets) =>
  Math.max(insets.bottom - Platform.select({ ios: 4, default: 0 }), 0);

export const getTabBarHeight = ({
  state,
  descriptors,
  dimensions,
  insets,
  style,
  ...rest
}: Options & {
  insets: EdgeInsets;
  style: Animated.WithAnimatedValue<StyleProp<ViewStyle>> | undefined;
}) => {
  // @ts-ignore
  const customHeight = StyleSheet.flatten(style)?.height;

  if (typeof customHeight === 'number') {
    return customHeight;
  }

  const isLandscape = dimensions.width > dimensions.height;
  const horizontalLabels = shouldUseHorizontalLabels({
    state,
    descriptors,
    dimensions,
    ...rest,
  });
  const paddingBottom = getPaddingBottom(insets);

  if (
    Platform.OS === 'ios' &&
    !Platform.isPad &&
    isLandscape &&
    horizontalLabels
  ) {
    return COMPACT_TABBAR_HEIGHT + paddingBottom;
  }

  return DEFAULT_TABBAR_HEIGHT + paddingBottom;
};

export default function BottomTabBar({
  state,
  navigation,
  descriptors,
  insets,
  style,
}: Props) {
  const { size } = useUserDevice();

  const { colors } = useTheme();
  const buildLink = useLinkBuilder();

  const focusedRoute = state.routes[state.index];
  const focusedDescriptor = descriptors[focusedRoute.key];
  const focusedOptions = focusedDescriptor.options;

  const {
    tabBarShowLabel,
    tabBarHideOnKeyboard = false,
    tabBarVisibilityAnimationConfig,
    tabBarStyle,
    tabBarBackground,
    tabBarActiveTintColor,
    tabBarInactiveTintColor,
    tabBarActiveBackgroundColor,
    tabBarInactiveBackgroundColor,
  } = focusedOptions;

  const dimensions = useSafeAreaFrame();
  const isKeyboardShown = useIsKeyboardShown();

  const onHeightChange = React.useContext(BottomTabBarHeightCallbackContext);

  const shouldShowTabBar = !(tabBarHideOnKeyboard && isKeyboardShown);

  const visibilityAnimationConfigRef = React.useRef(
    tabBarVisibilityAnimationConfig,
  );

  React.useEffect(() => {
    visibilityAnimationConfigRef.current = tabBarVisibilityAnimationConfig;
  });

  const [isTabBarHidden, setIsTabBarHidden] = React.useState(!shouldShowTabBar);

  const [visible] = React.useState(
    () => new Animated.Value(shouldShowTabBar ? 1 : 0),
  );

  React.useEffect(() => {
    const visibilityAnimationConfig = visibilityAnimationConfigRef.current;

    if (shouldShowTabBar) {
      const animation =
        visibilityAnimationConfig?.show?.animation === 'spring'
          ? Animated.spring
          : Animated.timing;

      animation(visible, {
        toValue: 1,
        useNativeDriver,
        duration: 250,
        ...visibilityAnimationConfig?.show?.config,
      }).start(({ finished }) => {
        if (finished) {
          setIsTabBarHidden(false);
        }
      });
    } else {
      setIsTabBarHidden(true);

      const animation =
        visibilityAnimationConfig?.hide?.animation === 'spring'
          ? Animated.spring
          : Animated.timing;

      animation(visible, {
        toValue: 0,
        useNativeDriver,
        duration: 200,
        ...visibilityAnimationConfig?.hide?.config,
      }).start();
    }

    return () => visible.stopAnimation();
  }, [visible, shouldShowTabBar]);

  const [layout, setLayout] = React.useState({
    height: 0,
    width: dimensions.width,
  });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { height, width } = e.nativeEvent.layout;

    onHeightChange?.(height);

    setLayout((layout) => {
      if (height === layout.height && width === layout.width) {
        return layout;
      }
      return {
        height,
        width,
      };
    });
  };

  const { routes } = state;

  const paddingBottom = getPaddingBottom(insets);
  const tabBarHeight = getTabBarHeight({
    state,
    descriptors,
    insets,
    dimensions,
    layout,
    deviceSize: size,
    style: [tabBarStyle, style],
  });

  const hasHorizontalLabels = shouldUseHorizontalLabels({
    state,
    descriptors,
    dimensions,
    layout,
    deviceSize: size,
  });

  const tabBarBackgroundElement = tabBarBackground?.();
  const bgColor = useThemeValue('background-default');
  return (
    <Animated.View
      style={[
        styles.tabBar,
        {
          backgroundColor:
            tabBarBackgroundElement != null ? 'transparent' : bgColor,
          borderTopColor: colors.border,
        },
        {
          transform: [
            {
              translateY: visible.interpolate({
                inputRange: [0, 1],
                outputRange: [
                  layout.height + paddingBottom + StyleSheet.hairlineWidth,
                  0,
                ],
              }),
            },
          ],
          // Absolutely position the tab bar so that the content is below it
          // This is needed to avoid gap at bottom when the tab bar is hidden
          position: isTabBarHidden ? 'absolute' : (null as any),
        },
        {
          height: tabBarHeight,
          paddingBottom,
          paddingHorizontal: Math.max(insets.left, insets.right),
        },
        tabBarStyle,
      ]}
      pointerEvents={isTabBarHidden ? 'none' : 'auto'}
      onLayout={handleLayout}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {tabBarBackgroundElement}
      </View>
      <Box accessibilityRole="tablist" style={styles.content}>
        {routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.dispatch({
                ...CommonActions.navigate({ name: route.name, merge: true }),
                target: state.key,
              });
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const accessibilityLabel =
            options.tabBarAccessibilityLabel !== undefined
              ? options.tabBarAccessibilityLabel
              : typeof label === 'string' && Platform.OS === 'ios'
              ? `${label}, tab, ${index + 1} of ${routes.length}`
              : undefined;

          return (
            <NavigationContext.Provider
              key={route.key}
              value={descriptors[route.key].navigation}
            >
              <NavigationRouteContext.Provider value={route}>
                <BottomTabItem
                  route={route}
                  focused={focused}
                  horizontal={hasHorizontalLabels}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  accessibilityLabel={accessibilityLabel}
                  to={buildLink(route.name, route.params)}
                  testID={options.tabBarTestID}
                  allowFontScaling={options.tabBarAllowFontScaling}
                  activeTintColor={tabBarActiveTintColor}
                  inactiveTintColor={tabBarInactiveTintColor}
                  activeBackgroundColor={tabBarActiveBackgroundColor}
                  inactiveBackgroundColor={tabBarInactiveBackgroundColor}
                  button={options.tabBarButton}
                  icon={
                    options.tabBarIcon ??
                    (({ color, size }) => (
                      <MissingIcon color={color} size={size} />
                    ))
                  }
                  badge={options.tabBarBadge}
                  badgeStyle={options.tabBarBadgeStyle}
                  label={label}
                  showLabel={tabBarShowLabel}
                  labelStyle={options.tabBarLabelStyle}
                  iconStyle={options.tabBarIconStyle}
                  style={options.tabBarItemStyle}
                />
              </NavigationRouteContext.Provider>
            </NavigationContext.Provider>
          );
        })}
      </Box>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 8,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
});
