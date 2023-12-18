import type { ComponentType } from 'react';
import { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeValue } from '../../hooks';
import { XStack } from '../../primitives';

import type { IStackNavigationOptions } from '../Navigation';
import type { IntlShape } from 'react-intl';

export type IPageHeaderProps = IStackNavigationOptions;

const usePageHeaderSearchOptions = (
  props: IPageHeaderProps,
  intl: IntlShape,
  colorList: { searchTextColor: string },
) => {
  if (!props) {
    return props;
  }

  const { headerSearchBarOptions } = props;

  if (headerSearchBarOptions) {
    return {
      ...props,
      headerSearchBarOptions: {
        hideNavigationBar: false,
        hideWhenScrolling: false,
        cancelButtonText: intl.formatMessage({ id: 'action__cancel' }),
        textColor: colorList.searchTextColor,
        tintColor: colorList.searchTextColor,
        ...headerSearchBarOptions,
      },
    };
  }
  return props;
};

function HeaderRightContainerHOC(Component?: ComponentType) {
  if (!Component) {
    return null;
  }
  // eslint-disable-next-line react/no-unstable-nested-components
  return function HeaderRightContainer(...props: any) {
    return (
      <XStack>
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
  const intl = useIntl();
  const textColor = useThemeValue('text');
  const reloadOptions = usePageHeaderSearchOptions(props, intl, {
    searchTextColor: textColor,
  });
  const headerProps = useHeaderRightProps(reloadOptions);
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions(headerProps);
  }, [navigation, headerProps]);

  return null;
};

PageHeader.usePageHeaderSearchOptions = usePageHeaderSearchOptions;

export { PageHeader };
