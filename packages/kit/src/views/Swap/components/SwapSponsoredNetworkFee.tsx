import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Dialog,
  Icon,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

const SPONSORED_COUPON_INFO_WIDTH = 56;
const SPONSORED_COUPON_SEPARATOR_STROKE = 2;
const SPONSORED_COUPON_CUTOUT_SIZE = 18;
const SPONSORED_COUPON_CUTOUT_OFFSET = SPONSORED_COUPON_CUTOUT_SIZE / 2;
const SPONSORED_FEES_HELP_CENTER_URL =
  'https://help.onekey.so/articles/14994693';

export function SwapSponsoredNetworkFee() {
  const intl = useIntl();

  const handleOpenHelpCenter = useCallback(() => {
    openUrlExternal(SPONSORED_FEES_HELP_CENTER_URL);
  }, []);

  const renderSponsoredCoupon = useCallback(
    () => (
      <Stack position="relative" alignSelf="stretch">
        <XStack overflow="hidden" borderRadius="$5" bg="$brand3">
          <XStack
            flex={1}
            px="$3.5"
            py="$3"
            gap="$3"
            alignItems="center"
            minWidth={0}
          >
            <Stack
              width={42}
              height={42}
              borderRadius="$full"
              bg="$brand9"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Icon name="GiftSolid" size="$4.5" color="$iconOnColor" />
            </Stack>
            <Stack flex={1} minWidth={0} gap="$1">
              <SizableText size="$headingMd" color="$text" numberOfLines={1}>
                {intl.formatMessage({
                  id: ETranslations.wallet_zero_network_fee__title,
                })}
              </SizableText>
              <SizableText
                size="$bodySmMedium"
                color="$textSubdued"
                numberOfLines={1}
              >
                {intl.formatMessage({
                  id: ETranslations.wallet_sponsored_by_onekey__title,
                })}
              </SizableText>
            </Stack>
          </XStack>
          <Stack
            width={SPONSORED_COUPON_INFO_WIDTH}
            position="relative"
            alignItems="center"
            justifyContent="center"
          >
            <Stack
              position="absolute"
              left={-(SPONSORED_COUPON_SEPARATOR_STROKE / 2)}
              top="$3"
              bottom="$3"
              borderLeftWidth={SPONSORED_COUPON_SEPARATOR_STROKE}
              borderStyle="dashed"
              borderColor="$borderSubdued"
              opacity={0.52}
            />
            <Stack
              width={28}
              height={28}
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              onPress={handleOpenHelpCenter}
              hoverStyle={{ opacity: 0.72 }}
              pressStyle={{ opacity: 0.56 }}
            >
              <Icon name="InfoCircleOutline" size="$4.5" color="$iconSubdued" />
            </Stack>
          </Stack>
        </XStack>
        <Stack
          position="absolute"
          right={SPONSORED_COUPON_INFO_WIDTH - SPONSORED_COUPON_CUTOUT_OFFSET}
          top={-SPONSORED_COUPON_CUTOUT_OFFSET}
          width={SPONSORED_COUPON_CUTOUT_SIZE}
          height={SPONSORED_COUPON_CUTOUT_SIZE}
          borderRadius="$full"
          bg="$bg"
          pointerEvents="none"
        />
        <Stack
          position="absolute"
          right={SPONSORED_COUPON_INFO_WIDTH - SPONSORED_COUPON_CUTOUT_OFFSET}
          bottom={-SPONSORED_COUPON_CUTOUT_OFFSET}
          width={SPONSORED_COUPON_CUTOUT_SIZE}
          height={SPONSORED_COUPON_CUTOUT_SIZE}
          borderRadius="$full"
          bg="$bg"
          pointerEvents="none"
        />
      </Stack>
    ),
    [handleOpenHelpCenter, intl],
  );

  const handleShowSponsoredInfo = useCallback(() => {
    const dialogInstance = Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.wallet_fee_sponsorship__title,
      }),
      showFooter: false,
      showCancelButton: false,
      renderContent: (
        <Stack gap="$4">
          {renderSponsoredCoupon()}
          <Stack px="$1" gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.wallet_sponsorship_availability_rules__desc,
              })}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.wallet_sponsored_tx_confirmation_may_take_longer__desc,
              })}
            </SizableText>
            <SizableText
              size="$bodySmMedium"
              color="$text"
              textDecorationLine="underline"
              cursor="pointer"
              alignSelf="flex-start"
              hoverStyle={{ opacity: 0.8 }}
              pressStyle={{ opacity: 0.7 }}
              onPress={handleOpenHelpCenter}
            >
              {intl.formatMessage({
                id: ETranslations.wallet_learn_about_sponsored_fees__action,
              })}
            </SizableText>
          </Stack>
          <Button
            testID="swap-sponsored-fee-got-it-btn"
            size="medium"
            onPress={() => {
              void dialogInstance?.close?.();
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_got_it })}
          </Button>
        </Stack>
      ),
    });
    return dialogInstance;
  }, [handleOpenHelpCenter, intl, renderSponsoredCoupon]);

  return (
    <XStack
      testID="swap-sponsored-network-fee-trigger"
      alignItems="center"
      gap="$2"
      cursor="pointer"
      onPress={handleShowSponsoredInfo}
      hoverStyle={{ opacity: 0.9 }}
      pressStyle={{ opacity: 0.82 }}
    >
      <Badge badgeType="success" badgeSize="sm">
        <Badge.Text>
          {intl.formatMessage({
            id: ETranslations.wallet_onekey_sponsored__title,
          })}
        </Badge.Text>
      </Badge>
    </XStack>
  );
}
