import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  HeightTransition,
  Icon,
  Image,
  NumberSizeableText,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import PreSwapInfoItem from '@onekeyhq/kit/src/views/Swap/components/PreSwapInfoItem';
import { PreSwapTipInfo } from '@onekeyhq/kit/src/views/Swap/components/PreSwapTipInfo';
import { ProtocolFeeComparisonList } from '@onekeyhq/kit/src/views/Swap/components/ProtocolFeeComparisonList';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IFetchQuoteResult,
  ISwapPreSwapData,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildMarketSwapReviewData,
  getMarketSwapReviewActionTranslationId,
} from '../utils/reviewUtils';

function MarketSwapReviewTokenItem({
  token,
  amount,
  isFloating,
}: {
  token?: ISwapToken;
  amount: string;
  isFloating?: boolean;
}) {
  const [settings] = useSettingsPersistAtom();

  const fiatValue = useMemo(() => {
    return token?.price && amount
      ? new BigNumber(token.price).multipliedBy(amount).toFixed()
      : '0';
  }, [amount, token?.price]);

  const networkImageUri = useMemo(() => {
    if (token?.networkLogoURI) {
      return token.networkLogoURI;
    }
    if (token?.networkId) {
      return networkUtils.getLocalNetworkInfo(token.networkId)?.logoURI;
    }
    return '';
  }, [token?.networkId, token?.networkLogoURI]);

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      flex={1}
      mr="$0.5"
    >
      <YStack gap="$1" flex={1}>
        <XStack alignItems="center">
          {isFloating ? (
            <Icon name="TildeOutline" size="$5" color="$text" />
          ) : null}
          <NumberSizeableText
            size="$heading3xl"
            formatter="balance"
            formatterOptions={{
              tokenSymbol: token?.symbol ?? '-',
            }}
          >
            {amount}
          </NumberSizeableText>
        </XStack>
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
          numberOfLines={1}
        >
          {fiatValue}
        </NumberSizeableText>
      </YStack>

      <Stack position="relative" width="$10" height="$10">
        <Image
          source={{ uri: token?.logoURI ?? '' }}
          width="$10"
          height="$10"
          borderRadius="$full"
          bg="$gray5"
        />
        {networkImageUri ? (
          <Stack
            position="absolute"
            right="$-1"
            bottom="$-1"
            p="$0.5"
            bg="$bgApp"
            borderRadius="$full"
          >
            <Image
              source={{ uri: networkImageUri }}
              width="$4"
              height="$4"
              borderRadius="$full"
            />
          </Stack>
        ) : null}
      </Stack>
    </XStack>
  );
}

function MarketSwapReviewInfoGroup({
  preSwapData,
}: {
  preSwapData: ISwapPreSwapData;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();

  const serviceFee = Number(preSwapData.fee?.percentageFee ?? 0.3);

  const slippage = useMemo(() => {
    if (!preSwapData.unSupportSlippage && preSwapData.slippage !== undefined) {
      return new BigNumber(preSwapData.slippage)
        .decimalPlaces(2, BigNumber.ROUND_DOWN)
        .toNumber();
    }

    return undefined;
  }, [preSwapData.slippage, preSwapData.unSupportSlippage]);

  const fee = useMemo(() => {
    if (
      new BigNumber(preSwapData.fee?.percentageFee ?? '0').isZero() ||
      new BigNumber(preSwapData.fee?.percentageFee ?? '0').isNaN()
    ) {
      return (
        <Badge badgeSize="sm" badgeType="success" gap="$1.5">
          <Icon name="PartyCelebrateSolid" size="$3" color="$iconSuccess" />
          <SizableText size="$bodySmMedium" color="$textSuccess">
            {intl.formatMessage({
              id: ETranslations.swap_stablecoin_0_fee,
            })}
          </SizableText>
        </Badge>
      );
    }

    return `${preSwapData.fee?.percentageFee ?? '-'}%`;
  }, [intl, preSwapData.fee?.percentageFee]);

  return (
    <YStack gap="$3">
      <PreSwapInfoItem
        title={intl.formatMessage({
          id: ETranslations.swap_page_provider_provider,
        })}
        value={preSwapData.providerInfo?.providerName ?? ''}
        popoverContent={intl.formatMessage({
          id: ETranslations.swap_review_provider_popover_content,
        })}
      />
      {!isNil(slippage) ? (
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.swap_page_provider_slippage_tolerance,
          })}
          value={`${slippage}%`}
          popoverContent={intl.formatMessage({
            id: ETranslations.slippage_tolerance_warning_message_1,
          })}
        />
      ) : null}
      {!isNil(preSwapData.minToAmount) &&
      new BigNumber(preSwapData.minToAmount).gt(0) ? (
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.swap_review_min_receive,
          })}
          value={
            <NumberSizeableText
              size="$bodyMd"
              formatter="balance"
              formatterOptions={{
                tokenSymbol: preSwapData.toToken?.symbol ?? '-',
              }}
            >
              {preSwapData.minToAmount}
            </NumberSizeableText>
          }
          popoverContent={intl.formatMessage({
            id: ETranslations.swap_review_min_receive_popover,
          })}
        />
      ) : null}
      <PreSwapInfoItem
        title={intl.formatMessage({
          id: ETranslations.provider_ios_popover_wallet_fee,
        })}
        value={fee}
        popoverContent={
          <Stack gap="$4">
            <Stack gap="$1">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.provider_ios_popover_onekey_fee_content,
                  },
                  { num: `${serviceFee}%` },
                )}
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.provider_ios_popover_onekey_fee_content_2,
                  },
                  { num: `${serviceFee}%` },
                )}
              </SizableText>
            </Stack>
            <ProtocolFeeComparisonList serviceFee={serviceFee} />
          </Stack>
        }
      />
      {preSwapData.fee?.estimatedFeeFiatValue ? (
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.provider_network_fee,
          })}
          value={
            <NumberSizeableText
              size="$bodyMd"
              formatter="value"
              formatterOptions={{
                currency: settings.currencyInfo.symbol,
              }}
            >
              {preSwapData.fee.estimatedFeeFiatValue}
            </NumberSizeableText>
          }
          popoverContent={intl.formatMessage({
            id: ETranslations.swap_review_network_cost_popover_content,
          })}
        />
      ) : null}
    </YStack>
  );
}

type IMarketSwapReviewDialogContentProps = {
  fromTokenAmount: string;
  onConfirm: () => Promise<void>;
  quoteResult: IFetchQuoteResult;
  slippage: number;
};

export function MarketSwapReviewDialogContent({
  fromTokenAmount,
  onConfirm,
  quoteResult,
  slippage,
}: IMarketSwapReviewDialogContentProps) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [isConfirming, setIsConfirming] = useState(false);
  const [showPreSwapTipInfo, setShowPreSwapTipInfo] =
    useState<IFetchQuoteResult['quoteShowTip']>(undefined);

  const isExternalWallet = useMemo(
    () =>
      accountUtils.isExternalWallet({
        walletId: activeAccount?.wallet?.id ?? '',
      }),
    [activeAccount?.wallet?.id],
  );
  const isHwWallet = useMemo(
    () =>
      accountUtils.isHwWallet({
        walletId: activeAccount?.wallet?.id ?? '',
      }),
    [activeAccount?.wallet?.id],
  );
  const isHWAndExBatchTransfer = useMemo(() => {
    const accountId = activeAccount?.account?.id ?? '';
    return (
      !!quoteResult.allowanceResult &&
      (accountUtils.isExternalAccount({ accountId }) ||
        accountUtils.isHwOrQrAccount({ accountId }))
    );
  }, [activeAccount?.account?.id, quoteResult.allowanceResult]);

  const preSwapData = useMemo(
    () =>
      buildMarketSwapReviewData({
        quoteResult,
        fromToken: quoteResult.fromTokenInfo,
        toToken: quoteResult.toTokenInfo,
        fromTokenAmount,
        slippage,
        isHWAndExBatchTransfer,
      }),
    [quoteResult, fromTokenAmount, slippage, isHWAndExBatchTransfer],
  );

  const actionText = useMemo(
    () =>
      intl.formatMessage({
        id: getMarketSwapReviewActionTranslationId({
          isExternalWallet,
          isHWAndExBatchTransfer,
          isHwWallet,
          shouldResetApprove: !!quoteResult.allowanceResult?.shouldResetApprove,
        }),
      }),
    [
      intl,
      isExternalWallet,
      isHWAndExBatchTransfer,
      isHwWallet,
      quoteResult.allowanceResult?.shouldResetApprove,
    ],
  );

  const runConfirm = useCallback(async () => {
    if (isConfirming) {
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  }, [isConfirming, onConfirm]);

  const handleConfirmPress = useCallback(() => {
    if (quoteResult.quoteShowTip) {
      setShowPreSwapTipInfo(quoteResult.quoteShowTip);
      return;
    }

    void runConfirm();
  }, [quoteResult.quoteShowTip, runConfirm]);

  const handleTipConfirm = useCallback(() => {
    setShowPreSwapTipInfo(undefined);
    void runConfirm();
  }, [runConfirm]);

  const handleTipCancel = useCallback(() => {
    setShowPreSwapTipInfo(undefined);
  }, []);

  return (
    <HeightTransition initialHeight={355}>
      <YStack gap="$4">
        <YStack gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.swap_review_you_pay })}
          </SizableText>
          <MarketSwapReviewTokenItem
            token={preSwapData.fromToken}
            amount={preSwapData.fromTokenAmount ?? '0'}
          />
        </YStack>

        <YStack gap="$1">
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.provider_sort_item_received,
              })}
            </SizableText>
            <Popover
              title={intl.formatMessage({
                id: ETranslations.provider_sort_item_received,
              })}
              renderTrigger={
                <Icon
                  cursor="pointer"
                  name="InfoCircleOutline"
                  size="$3.5"
                  color="$iconSubdued"
                />
              }
              renderContent={() => (
                <Stack p="$4">
                  <SizableText size="$bodyMd">
                    {intl.formatMessage({
                      id: quoteResult.isFloating
                        ? ETranslations.provider_route_changelly_float
                        : ETranslations.provider_ios_popover_onekey_fee_content_sub,
                    })}
                  </SizableText>
                </Stack>
              )}
            />
          </XStack>

          <MarketSwapReviewTokenItem
            token={preSwapData.toToken}
            amount={preSwapData.toTokenAmount ?? '0'}
            isFloating={quoteResult.isFloating}
          />
        </YStack>

        <Divider />

        {showPreSwapTipInfo ? (
          <PreSwapTipInfo
            quoteShowTip={showPreSwapTipInfo}
            onConfirm={handleTipConfirm}
            onCancel={handleTipCancel}
          />
        ) : (
          <YStack gap="$4">
            <MarketSwapReviewInfoGroup preSwapData={preSwapData} />
            <Button
              variant="primary"
              size="medium"
              onPress={handleConfirmPress}
              loading={isConfirming}
              disabled={isConfirming}
            >
              {actionText}
            </Button>
          </YStack>
        )}
      </YStack>
    </HeightTransition>
  );
}
