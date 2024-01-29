import type { ComponentType } from 'react';
import { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeValue } from '../../hooks';
import { XStack } from '../../primitives';

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

function HeaderRightContainerHOC(Component?: ComponentType) {
  if (!Component) {
    return null;
  }
  // eslint-disable-next-line react/no-unstable-nested-components
  return function HeaderRightContainer(...props: any) {
    return (
      <XStack alignSelf="center">
        <Component {...props} />
      </XStack>
    );
  };
}

const useHeaderRightProps = (props: IPageHeaderProps) => {
  if (platformEnv.isNativeIOS) {
    return {
      ...props,
      headerRight: HeaderRightContainerHOC(props.headerRight as any),
    };
  }
  return props;
};

const PageHeader = (props: IPageHeaderProps) => {
  const pageHeaderReload = usePageHeaderReloadOptions();
  const reloadOptions = pageHeaderReload.reload(props);
  const headerProps = useHeaderRightProps(reloadOptions);
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions(headerProps);
  }, [navigation, headerProps]);

  return null;
};

PageHeader.usePageHeaderReloadOptions = usePageHeaderReloadOptions;

export { PageHeader };
