import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsOverlayPage } from '../../hocs';
import { useTheme } from '../../hooks';
import {
  toNoGlassHeaderItems,
  wrapHeaderRenderInGlass,
} from '../../primitives/Button/GlassHeaderContext';
import HeaderSearchBar from '../Navigation/Header/HeaderSearchBar';

import type {
  IModalNavigationOptions,
  IStackNavigationOptions,
} from '../Navigation';

export type IPageHeaderProps = IStackNavigationOptions &
  IModalNavigationOptions & {
    // iOS 26 only: render this header slot WITHOUT the system Liquid Glass
    // capsule (hidesSharedBackground). Use when the content isn't a single icon
    // button — e.g. a text Button — where the glass pill looks wrong (extra
    // width + the button's own press style showing through). No-op on other
    // platforms / iOS < 26.
    headerLeftNoGlass?: boolean;
    headerRightNoGlass?: boolean;
  };

// `reload()` returns a flat options object whose values are reference-stable by
// convention (callers wrap header render functions in `useCallback`). A shallow
// own-key comparison is therefore enough to detect real changes, and avoids the
// cost of a recursive deep-equal on this hot, every-page render path.
function shallowEqualHeaderOptions(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  if (a === b) {
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (!Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

const usePageHeaderReloadOptions = () => {
  const intl = useIntl();
  const theme = useTheme();
  const searchTextColor = theme.text.val;
  const reload = useCallback(
    (props: IPageHeaderProps) => {
      if (!props) {
        return props;
      }

      const {
        headerSearchBarOptions,
        headerTransparent,
        headerStyle,
        headerLeftNoGlass,
        headerRightNoGlass,
        ...restProps
      } = props;
      // toNoGlassHeaderItems returns undefined off iOS 26, so these are truthy
      // only when the slot opted out of glass AND we're on an iOS 26 glass bar
      // — no separate platform gate needed.
      const noGlassLeftItems = headerLeftNoGlass
        ? toNoGlassHeaderItems(restProps.headerLeft)
        : undefined;
      const noGlassRightItems = headerRightNoGlass
        ? toNoGlassHeaderItems(restProps.headerRight)
        : undefined;
      return {
        ...restProps,
        // iOS 26 header buttons: by default wrap the render fn so the button
        // detects it's in the native glass bar and drops its self-drawn
        // background/press (see GlassHeaderContext). When the slot opts out via
        // headerLeft/RightNoGlass (used for text Buttons), route it through an
        // `unstable_*Items` custom item carrying hidesSharedBackground so UIKit
        // draws no glass capsule. Both are no-ops on other platforms / iOS < 26.
        ...(restProps.headerLeft &&
          (noGlassLeftItems
            ? {
                headerLeft: undefined,
                unstable_headerLeftItems: noGlassLeftItems,
              }
            : { headerLeft: wrapHeaderRenderInGlass(restProps.headerLeft) })),
        ...(restProps.headerRight &&
          (noGlassRightItems
            ? {
                headerRight: undefined,
                unstable_headerRightItems: noGlassRightItems,
              }
            : { headerRight: wrapHeaderRenderInGlass(restProps.headerRight) })),
        ...(headerTransparent && {
          headerStyle: [headerStyle ?? {}, { backgroundColor: 'transparent' }],
        }),
        ...(!platformEnv.isNativeIOS &&
          headerSearchBarOptions && {
            headerSearchBarOptions: {
              hideNavigationBar: false,
              hideWhenScrolling: false,
              cancelButtonText: intl.formatMessage({
                id: ETranslations.global_cancel,
              }),
              textColor: searchTextColor,
              tintColor: searchTextColor,
              ...headerSearchBarOptions,
            },
          }),
      };
    },
    [intl, searchTextColor],
  );
  return useMemo(() => ({ reload }), [reload]);
};

/**
 * Renders a page header component that manages navigation header options and conditional UI elements based on platform and modal state.
 *
 * Applies navigation header options using a reload mechanism, conditionally renders a search bar on native iOS, and displays a divider unless on a modal page or iOS iPad.
 *
 * @returns The rendered page header UI, or `null` if the header is not shown.
 */
function PageHeader(props: IPageHeaderProps) {
  const pageHeaderReload = usePageHeaderReloadOptions();
  const nextReloadOptions = pageHeaderReload.reload(props);

  // `reload()` returns a brand-new object on every render. Feeding that fresh
  // reference into the layout effect below (and into `navigation.setOptions`)
  // makes the effect run on every render → setOptions → navigator re-render →
  // this screen re-renders → effect runs again. On heavy, frequently
  // re-rendering pages (e.g. Earn) that self-sustaining loop trips React's
  // "Maximum update depth exceeded". Keep the previous reference whenever the
  // resolved options are shallowly equal, so the effect dependency only changes
  // when the options actually change.
  const reloadOptionsRef = useRef(nextReloadOptions);
  if (
    !shallowEqualHeaderOptions(
      reloadOptionsRef.current as Record<string, unknown>,
      nextReloadOptions as Record<string, unknown>,
    )
  ) {
    reloadOptionsRef.current = nextReloadOptions;
  }
  const reloadOptions = reloadOptionsRef.current;

  const navigation = useNavigation();
  useLayoutEffect(() => {
    if (reloadOptions.headerShown === false) {
      navigation.setOptions({
        headerShown: false,
      });
    } else {
      navigation.setOptions(reloadOptions);
    }
  }, [navigation, reloadOptions]);

  const isModal = useIsOverlayPage();
  const { headerSearchBarOptions } = props;

  if (reloadOptions.headerShown === false) {
    return null;
  }
  // Android & Web HeaderSearchBar in packages/components/src/layouts/Navigation/Header/HeaderView.tsx
  return platformEnv.isNativeIOS && headerSearchBarOptions ? (
    <HeaderSearchBar
      autoFocus={headerSearchBarOptions?.autoFocus}
      placeholder={headerSearchBarOptions?.placeholder}
      onChangeText={headerSearchBarOptions?.onChangeText}
      onSearchTextChange={headerSearchBarOptions?.onSearchTextChange}
      onBlur={headerSearchBarOptions?.onBlur}
      onFocus={headerSearchBarOptions?.onFocus}
      isModalScreen={isModal}
      onSearchButtonPress={headerSearchBarOptions?.onSearchButtonPress}
      addOns={headerSearchBarOptions?.addOns}
      searchBarInputValue={headerSearchBarOptions?.searchBarInputValue}
    />
  ) : null;
}

PageHeader.usePageHeaderReloadOptions = usePageHeaderReloadOptions;

export { PageHeader };
