import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { useNavigation } from '@onekeyhq/kit/src/hooks';

import Box from '../Box';
import Text from '../Text';

import type { MessageDescriptor } from 'react-intl';

export interface HeaderTitleProps {
  i18nTitle?: MessageDescriptor['id'];
  title?: string;
  subtitle?: string;
}

const HeaderTitle: FC<HeaderTitleProps> = ({ title, subtitle, i18nTitle }) => {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const notFirstPage =
    navigation.getState().routes.length > 0 ? 'Heading' : 'PageHeading';
  const intl = useIntl();

  const SmallScreenTitle = useMemo(
    () => (
      <Box
        flex={1}
        justifyContent="center"
        alignItems={notFirstPage ? 'center' : 'flex-start'}
        style={StyleSheet.absoluteFill}
        zIndex={-1}
      >
        <Text typography={notFirstPage ? 'Heading' : 'PageHeading'}>
          {i18nTitle ? intl.formatMessage({ id: i18nTitle }) : title}
        </Text>
        {subtitle && (
          <Text typography="Caption" color="text-subdued">
            {subtitle}
          </Text>
        )}
      </Box>
    ),
    [i18nTitle, intl, notFirstPage, subtitle, title],
  );

  const LargeScreenTitle = useMemo(
    () => (
      <Box flex={1} flexDirection="row" alignItems="baseline">
        <Text typography="Heading">{title}</Text>
        {subtitle && (
          <Text typography="Body2" ml="12px" color="text-subdued">
            {subtitle}
          </Text>
        )}
      </Box>
    ),
    [subtitle, title],
  );

  return isVertical ? SmallScreenTitle : LargeScreenTitle;
};

export default HeaderTitle;
