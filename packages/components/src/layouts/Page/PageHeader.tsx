import { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { useThemeValue } from '../../hooks';

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

const PageHeader = (props: IPageHeaderProps) => {
  const intl = useIntl();
  const textColor = useThemeValue('text');
  const reloadOptions = usePageHeaderSearchOptions(props, intl, {
    searchTextColor: textColor,
  });
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions(reloadOptions);
  }, [navigation, reloadOptions]);

  return null;
};

PageHeader.usePageHeaderSearchOptions = usePageHeaderSearchOptions;

export { PageHeader };
