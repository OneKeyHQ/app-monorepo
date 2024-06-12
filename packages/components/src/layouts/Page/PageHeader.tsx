import { useCallback, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useThemeValue } from '../../hooks';

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

      const { headerSearchBarOptions, headerTransparent, headerStyle } = props;
      return {
        ...props,
        ...(headerTransparent && {
          headerStyle: [headerStyle ?? {}, { backgroundColor: 'transparent' }],
        }),
        ...(headerSearchBarOptions && {
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

const PageHeader = (props: IPageHeaderProps) => {
  const pageHeaderReload = usePageHeaderReloadOptions();
  const reloadOptions = pageHeaderReload.reload(props);
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions(reloadOptions);
  }, [navigation, reloadOptions]);

  return null;
};

PageHeader.usePageHeaderReloadOptions = usePageHeaderReloadOptions;

export { PageHeader };
