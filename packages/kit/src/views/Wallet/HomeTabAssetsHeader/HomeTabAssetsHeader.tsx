import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  Icon,
  IconButton,
  Pressable,
  Text,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { FormatCurrencyNumber } from '../../../components/Format';
import { OverviewBadge } from '../../Overview/components/OverviewBadge';

import type BigNumber from 'bignumber.js';

export type IHomeTabAssetsHeaderProps = {
  icon: ICON_NAMES;
  title: string;
  extraIcon?: ICON_NAMES;
  extraLabel: string;
  onExtraPress?: () => void;
  showRoundTop?: boolean;
  borderColor?: string; // 'transparent'  'border-subdued'
  onPress?: () => void;
  usdFiatValue: string | undefined;
  shareRate: BigNumber;
};
function HomeTabAssetsHeaderCmp({
  icon,
  title,
  extraIcon,
  extraLabel,
  onExtraPress,
  showRoundTop,
  borderColor = 'border-subdued',
  onPress,
  usdFiatValue,
  shareRate,
}: IHomeTabAssetsHeaderProps) {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const iconOuterWidth = isVerticalLayout ? '24px' : '32px';
  const iconInnerWidth = isVerticalLayout ? 12 : 16;
  const iconBorderRadius = isVerticalLayout ? '12px' : '16px';

  const Container = onPress ? Pressable.Item : Box;

  const accountTokensValueText = useMemo(
    () =>
      !usdFiatValue ? (
        ' '
      ) : (
        <FormatCurrencyNumber value={0} convertValue={usdFiatValue} />
      ),
    [usdFiatValue],
  );
  return (
    <Container
      p={4}
      shadow={undefined}
      borderTopRadius={showRoundTop ? '12px' : 0}
      borderTopWidth={showRoundTop ? 1 : 0}
      borderWidth={1}
      borderBottomWidth={0}
      borderColor={borderColor}
      onPress={onPress}
      flexDirection="column"
      bg="surface-subdued"
    >
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box
          w={iconOuterWidth}
          h={iconOuterWidth}
          borderRadius={iconBorderRadius}
          bg="decorative-icon-one"
          justifyContent="center"
          alignItems="center"
          mr={isVerticalLayout ? '8px' : '12px'}
        >
          <Icon size={iconInnerWidth} color="icon-on-primary" name={icon} />
        </Box>
        <Text typography={{ sm: 'Body1Strong', md: 'Heading' }}>{title}</Text>
        {!isVerticalLayout && (
          <Box flexDirection="row" alignItems="center">
            <Box
              mx="8px"
              my="auto"
              w="4px"
              h="4px"
              borderRadius="2px"
              bg="text-default"
            />
            <Text typography={{ sm: 'DisplayLarge', md: 'Heading' }}>
              {accountTokensValueText}
            </Text>
          </Box>
        )}
        {shareRate.isNaN() ? null : <OverviewBadge rate={shareRate} />}
        <Box ml="auto" flexDirection="row" alignItems="center">
          <>
            {extraLabel ? (
              <Text
                color="text-subdued"
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              >
                {extraLabel}
              </Text>
            ) : null}

            {onExtraPress ? (
              <IconButton
                size="sm"
                borderRadius={17}
                name={extraIcon as ICON_NAMES}
                bg="action-secondary-default"
                onPress={onExtraPress}
              />
            ) : (
              <Icon name={extraIcon as ICON_NAMES} color="icon-subdued" />
            )}
          </>
        </Box>
      </Box>

      <Box mt={isVerticalLayout ? '8px' : '16px'}>
        {isVerticalLayout ? (
          <Text typography={{ sm: 'DisplayLarge', md: 'Heading' }}>
            {accountTokensValueText}
          </Text>
        ) : (
          <Box flexDirection="row" w="full">
            <Typography.Subheading color="text-subdued" flex={1}>
              {intl.formatMessage({ id: 'title__assets' })}
            </Typography.Subheading>
            <Typography.Subheading
              color="text-subdued"
              flex={1}
              textAlign="right"
            >
              {intl.formatMessage({ id: 'content__price_uppercase' })}
            </Typography.Subheading>
            <Typography.Subheading
              color="text-subdued"
              flex={1}
              textAlign="right"
            >
              {intl.formatMessage({ id: 'form__value' })}
            </Typography.Subheading>
          </Box>
        )}
      </Box>
    </Container>
  );
}
export const HomeTabAssetsHeader = memo(HomeTabAssetsHeaderCmp);
