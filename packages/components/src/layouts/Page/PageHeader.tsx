import { memo, useCallback, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EPageType, usePageType } from '../../hocs';
import { useIsHorizontalLayout, useThemeValue } from '../../hooks';
import { Stack } from '../../primitives';
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

function HeaderLine() {
  const isHorizontal = useIsHorizontalLayout();
  return isHorizontal ? (
    <Stack h={StyleSheet.hairlineWidth} w="100%" bg="$borderSubdued" />
  ) : null;
}

const MemoHeaderLine = memo(HeaderLine);

function PageHeader(props: IPageHeaderProps) {
  const pageHeaderReload = usePageHeaderReloadOptions();
  const reloadOptions = pageHeaderReload.reload(props);
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions(reloadOptions);
  }, [navigation, reloadOptions]);

  const pageType = usePageType();

  const isModal = pageType === EPageType.modal;
  const { headerSearchBarOptions } = props;
  // Android & Web HeaderSearchBar in packages/components/src/layouts/Navigation/Header/HeaderView.tsx
  return (
    <>
      {platformEnv.isNativeIOS && headerSearchBarOptions ? (
        <HeaderSearchBar
          autoFocus={headerSearchBarOptions?.autoFocus}
          placeholder={headerSearchBarOptions?.placeholder}
          onChangeText={headerSearchBarOptions?.onChangeText}
          onSearchTextChange={headerSearchBarOptions?.onSearchTextChange}
          onBlur={headerSearchBarOptions?.onBlur}
          onFocus={headerSearchBarOptions?.onFocus}
          isModalScreen={isModal}
          onSearchButtonPress={headerSearchBarOptions?.onSearchButtonPress}
        />
      ) : null}
      {isModal ? null : <MemoHeaderLine />}
    </>
  );
}

PageHeader.usePageHeaderReloadOptions = usePageHeaderReloadOptions;

export { PageHeader };
