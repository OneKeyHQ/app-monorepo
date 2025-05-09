import { memo, useCallback, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Divider } from '../../content';
import { EPageType, usePageType } from '../../hocs';
import { useIsHorizontalLayout, useThemeValue } from '../../hooks';
import HeaderSearchBar from '../Navigation/Header/HeaderSearchBar';

import type { IStackStyle } from '../../primitives';
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

function BasicPageHeaderDivider(props: IStackStyle) {
  const isHorizontal = useIsHorizontalLayout();
  return isHorizontal ? <Divider {...props} /> : null;
}

export const PageHeaderDivider = memo(BasicPageHeaderDivider);

function PageHeader(props: IPageHeaderProps) {
  const pageHeaderReload = usePageHeaderReloadOptions();
  const reloadOptions = pageHeaderReload.reload(props);
  const navigation = useNavigation();
  useLayoutEffect(() => {
    if (reloadOptions.headerShown) {
      navigation.setOptions(reloadOptions);
    }
  }, [navigation, reloadOptions]);

  const pageType = usePageType();

  const isModal = pageType === EPageType.modal;
  const { headerSearchBarOptions } = props;

  if (!reloadOptions.headerShown) {
    return null;
  }
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
      {isModal ? null : <PageHeaderDivider />}
    </>
  );
}

PageHeader.usePageHeaderReloadOptions = usePageHeaderReloadOptions;

export { PageHeader };
