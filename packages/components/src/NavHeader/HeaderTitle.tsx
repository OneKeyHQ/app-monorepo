import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { useIsVerticalLayout } from '@onekeyhq/components';

import Box from '../Box';
import Text from '../Text';

import type { MessageDescriptor } from 'react-intl';

export interface HeaderTitleProps {
  i18nTitle?: MessageDescriptor['id'];
  title?: string;
  i18nSubtitle?: MessageDescriptor['id'];
  subtitle?: string;
  inCenter?: boolean;
}

const HeaderTitle: FC<HeaderTitleProps> = ({
  title,
  subtitle,
  i18nTitle,
  i18nSubtitle,
  inCenter = true,
  children,
}) => {
  const isVertical = useIsVerticalLayout();
  const intl = useIntl();
  const [titleEl, subtitleEl] = useMemo(
    () => [
      i18nTitle ? intl.formatMessage({ id: i18nTitle }) : title,
      i18nSubtitle ? intl.formatMessage({ id: i18nSubtitle }) : subtitle,
    ],
    [i18nTitle, intl, title, i18nSubtitle, subtitle],
  );

  const SmallScreenTitle = useMemo(
    () => (
      <Box
        flex={1}
        justifyContent="center"
        alignItems={inCenter ? 'center' : 'flex-start'}
        style={StyleSheet.absoluteFill}
        zIndex={-1}
      >
        {children}
        {!!titleEl && (
          <Text typography={inCenter ? 'Heading' : 'PageHeading'}>
            {titleEl}
          </Text>
        )}
        {!!subtitleEl && (
          <Text typography="Caption" color="text-subdued">
            {subtitleEl}
          </Text>
        )}
      </Box>
    ),
    [children, inCenter, subtitleEl, titleEl],
  );

  const LargeScreenTitle = useMemo(
    () => (
      <Box flex={1} flexDirection="row" alignItems="baseline">
        {children}
        {!!titleEl && <Text typography="Heading">{titleEl}</Text>}
        {!!subtitleEl && (
          <Text typography="Body2" ml="12px" color="text-subdued">
            {subtitleEl}
          </Text>
        )}
      </Box>
    ),
    [children, subtitleEl, titleEl],
  );

  return isVertical ? SmallScreenTitle : LargeScreenTitle;
};

export default HeaderTitle;
