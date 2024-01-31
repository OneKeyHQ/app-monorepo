import { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { useThemeValue } from '../../hooks';

import type { IStackNavigationOptions } from '../Navigation';

export type IPageHeaderProps = IStackNavigationOptions;

const usePageHeaderReloadOptions = () => {
  const intl = useIntl();
  const searchTextColor = useThemeValue('text');
  const reload = (props: IPageHeaderProps) => {
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
          cancelButtonText: intl.formatMessage({ id: 'action__cancel' }),
          textColor: searchTextColor,
          tintColor: searchTextColor,
          ...headerSearchBarOptions,
        },
      }),
    };
  };
  return { reload };
};

const PageHeader = (props: IPageHeaderProps) => {
  const pageHeaderReload = usePageHeaderReloadOptions();
  const reloadOptions = pageHeaderReload.reload(props);
  const headerProps = reloadOptions;
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions(headerProps);
  }, [navigation, headerProps]);

  return null;
};

PageHeader.usePageHeaderReloadOptions = usePageHeaderReloadOptions;

export { PageHeader };
