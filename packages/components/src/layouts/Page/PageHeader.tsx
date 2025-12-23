import { useCallback, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsModalPage } from '../../hocs';
import { useThemeValue } from '../../hooks';
import HeaderSearchBar from '../Navigation/Header/HeaderSearchBar';

import type {
  IModalNavigationOptions,
  IStackNavigationOptions,
} from '../Navigation';

export type IPageHeaderProps = IStackNavigationOptions &
  IModalNavigationOptions;

const usePageHeaderReloadOptions = () => {
  const intl = useIntl();
  const searchTextColor = useThemeValue('text');
  const reload = useCallback(
    (props: IPageHeaderProps) => {
      if (!props) {
        return props;
      }

      const {
        headerSearchBarOptions,
        headerTransparent,
        headerStyle,
        ...restProps
      } = props;
      return {
        ...restProps,
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
  const reloadOptions = pageHeaderReload.reload(props);
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

  const isModal = useIsModalPage();
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
