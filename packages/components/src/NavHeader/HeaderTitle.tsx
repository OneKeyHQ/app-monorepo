import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { useIsVerticalLayout } from '@onekeyhq/components';

import Box from '../Box';
import Text from '../Text';

import type { MessageDescriptor } from 'react-intl';

export interface HeaderTitleProps {
  title?: MessageDescriptor['id'];
  titleString?: string;
  subtitle?: MessageDescriptor['id'];
  subtitleString?: string;
  inCenter?: boolean;
}

const HeaderTitle: FC<HeaderTitleProps> = ({
  title,
  subtitle,
  titleString,
  subtitleString,
  inCenter = true,
}) => {
  const isVertical = useIsVerticalLayout();
  const intl = useIntl();
  const [titleEl, subtitleEl] = useMemo(
    () => [
      title ? intl.formatMessage({ id: title }) : titleString,
      subtitle ? intl.formatMessage({ id: subtitle }) : subtitleString,
    ],
    [title, intl, titleString, subtitle, subtitleString],
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
        <Text typography={inCenter ? 'Heading' : 'PageHeading'}>{titleEl}</Text>
        {!!subtitleEl && (
          <Text typography="Caption" color="text-subdued">
            {subtitleEl}
          </Text>
        )}
      </Box>
    ),
    [inCenter, subtitleEl, titleEl],
  );

  const LargeScreenTitle = useMemo(
    () => (
      <Box flex={1} flexDirection="row" alignItems="baseline">
        <Text typography="Heading">{titleEl}</Text>
        {!!subtitleEl && (
          <Text typography="Body2" ml="12px" color="text-subdued">
            {subtitleEl}
          </Text>
        )}
      </Box>
    ),
    [subtitleEl, titleEl],
  );

  return isVertical ? SmallScreenTitle : LargeScreenTitle;
};

export default HeaderTitle;
