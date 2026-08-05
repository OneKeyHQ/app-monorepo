import { useCallback } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Button,
  Dialog,
  Icon,
  InteractiveIcon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useClipboard,
  useDialogInstance,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { SwapTestIDs } from '../../testIDs';

// cspell:words xstock xStocks
const STOCK_ISSUER_NAMES: Record<string, string> = {
  coingecko: 'Ondo',
  ondo: 'Ondo',
  xstock: 'xStocks',
};

const TOKEN_RATIO_FAQ_ITEMS = [
  {
    question: ETranslations.trade_stocks_does_the_ratio_change,
    answer: ETranslations.trade_stocks_ratio_change_explanation,
  },
  {
    question:
      ETranslations.trade_stocks_price_and_amount_display_after_ratio_change,
    answer: ETranslations.trade_stocks_price_adjustment_message,
  },
] as const;

function getStockIssuerName(source?: string) {
  const normalizedSource = source?.trim().toLowerCase();
  if (!normalizedSource) {
    return '--';
  }
  return STOCK_ISSUER_NAMES[normalizedSource] ?? source ?? '--';
}

function TokenDetailRow({
  label,
  labelAction,
  children,
}: {
  label: string;
  labelAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <XStack
      h={44}
      px="$3"
      py="$3"
      borderRadius="$3"
      bg="$bgSubdued"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
    >
      <XStack alignItems="center" gap="$1" flexShrink={1}>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {label}
        </SizableText>
        {labelAction}
      </XStack>
      {children}
    </XStack>
  );
}

function TokenRatioDialogContent() {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const handleClose = useCallback(() => {
    void dialog.close();
  }, [dialog]);

  return (
    <YStack gap="$4" testID={SwapTestIDs.stockTokenRatioDialog}>
      <SizableText size="$headingMd" color="$text" textAlign="center">
        {intl.formatMessage({
          id: ETranslations.trade_stocks_token_to_share_ratio,
        })}
      </SizableText>
      <SizableText size="$bodyMd" color="$text">
        {intl.formatMessage({
          id: ETranslations.trade_stocks_token_to_share_ratio_description,
        })}
      </SizableText>
      <Accordion type="multiple">
        {TOKEN_RATIO_FAQ_ITEMS.map(({ question, answer }) => (
          <Accordion.Item key={question} value={question}>
            <Accordion.Trigger
              unstyled
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
              borderWidth={0}
              bg="$transparent"
              p={0}
              py="$2"
              m={0}
              cursor="pointer"
            >
              {({ open }: { open: boolean }) => (
                <>
                  <SizableText
                    flex={1}
                    pr="$3"
                    size="$bodyMdMedium"
                    color="$text"
                  >
                    {intl.formatMessage({ id: question })}
                  </SizableText>
                  <YStack
                    animation="quick"
                    animateOnly={ANIMATE_ONLY_TRANSFORM}
                    rotate={open ? '180deg' : '0deg'}
                  >
                    <Icon
                      name={open ? 'MinusLargeOutline' : 'PlusLargeOutline'}
                      size="$5"
                      color="$iconSubdued"
                    />
                  </YStack>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.HeightAnimator animation="quick">
              <Accordion.Content
                unstyled
                p={0}
                pb="$2"
                pr="$8"
                animation="100ms"
                animateOnly={ANIMATE_ONLY_OPACITY}
                enterStyle={{ opacity: 0 }}
                exitStyle={{ opacity: 0 }}
              >
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({ id: answer })}
                </SizableText>
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        ))}
      </Accordion>
      <Button
        testID={SwapTestIDs.stockTokenRatioDialogClose}
        size="large"
        variant="primary"
        onPress={handleClose}
      >
        {intl.formatMessage({ id: ETranslations.global_got_it })}
      </Button>
    </YStack>
  );
}

function ContractAddressValue({
  address,
  networkId,
}: {
  address: string;
  networkId?: string;
}) {
  const { copyText } = useClipboard();
  const handleCopy = useCallback(() => {
    copyText(address);
  }, [address, copyText]);
  const handleOpen = useCallback(() => {
    void openExplorerAddressUrl({
      networkId,
      address,
      openInExternal: true,
    });
  }, [address, networkId]);

  return (
    <XStack alignItems="center" gap="$1.5" minWidth={0}>
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        numberOfLines={1}
        flexShrink={1}
      >
        {accountUtils.shortenAddress({
          address,
          leadingLength: 6,
          trailingLength: 6,
        })}
      </SizableText>
      <InteractiveIcon
        testID={SwapTestIDs.stockTokenContractCopy}
        icon="Copy3Outline"
        size="$4"
        onPress={handleCopy}
      />
      <InteractiveIcon
        testID={SwapTestIDs.stockTokenContractOpen}
        icon="OpenOutline"
        size="$4"
        onPress={handleOpen}
      />
    </XStack>
  );
}

export function SwapStockTokenDetails({
  loading,
  networkId,
  tokenDetail,
}: {
  loading?: boolean;
  networkId?: string;
  tokenDetail?: IMarketTokenDetail;
}) {
  const intl = useIntl();
  const stock = tokenDetail?.stock;
  const tokenAddress = tokenDetail?.address;
  const issuerName = getStockIssuerName(stock?.source);
  const issuerWebsite = tokenDetail?.extraData?.website;
  const handleOpenIssuerWebsite = useCallback(() => {
    if (issuerWebsite) {
      openUrlExternal(issuerWebsite);
    }
  }, [issuerWebsite]);
  const handleShowRatioInfo = useCallback(() => {
    Dialog.show({
      showHeader: false,
      showFooter: false,
      contentContainerProps: {
        p: '$6',
      },
      floatingPanelProps: {
        width: 420,
      },
      renderContent: <TokenRatioDialogContent />,
    });
  }, []);

  if (!loading && (!stock || !tokenAddress)) {
    return null;
  }

  const ratioValue =
    !loading && stock?.tokenToAssetRatio
      ? [stock.tokenToAssetRatio, stock.underlyingAssetTicker]
          .filter(Boolean)
          .join(' ')
      : undefined;

  return (
    <YStack mt="$6" gap="$2.5" testID={SwapTestIDs.stockTokenDetails}>
      <SizableText size="$bodyMdMedium" color="$text">
        {intl.formatMessage({ id: ETranslations.trade_stocks_token_details })}
      </SizableText>
      <YStack
        gap="$2"
        testID={loading ? SwapTestIDs.stockTokenDetailsLoading : undefined}
      >
        <TokenDetailRow
          label={intl.formatMessage({
            id: ETranslations.trade_stocks_underlying_asset,
          })}
        >
          {loading ? (
            <Skeleton h="$5" w="$12" />
          ) : (
            <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
              {stock?.underlyingAssetTicker ?? '--'}
            </SizableText>
          )}
        </TokenDetailRow>
        <TokenDetailRow
          label={intl.formatMessage({
            id: ETranslations.trade_stocks_token_issuer,
          })}
        >
          {loading ? (
            <Skeleton h="$5" w="$16" />
          ) : (
            <XStack alignItems="center" gap="$1.5">
              <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
                {issuerName}
              </SizableText>
              {issuerWebsite ? (
                <InteractiveIcon
                  testID={SwapTestIDs.stockTokenIssuerOpen}
                  icon="OpenOutline"
                  size="$4"
                  onPress={handleOpenIssuerWebsite}
                />
              ) : null}
            </XStack>
          )}
        </TokenDetailRow>
        {ratioValue ? (
          <TokenDetailRow
            label={intl.formatMessage({
              id: ETranslations.trade_stocks_token_to_share_ratio,
            })}
            labelAction={
              <InteractiveIcon
                testID={SwapTestIDs.stockTokenRatioInfo}
                icon="InfoCircleOutline"
                size="$4"
                onPress={handleShowRatioInfo}
              />
            }
          >
            <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
              {ratioValue}
            </SizableText>
          </TokenDetailRow>
        ) : null}
        <TokenDetailRow
          label={intl.formatMessage({
            id: ETranslations.trade_stocks_contract_address,
          })}
        >
          {loading || !tokenAddress ? (
            <Skeleton h="$5" w="$32" />
          ) : (
            <ContractAddressValue
              address={tokenAddress}
              networkId={networkId}
            />
          )}
        </TokenDetailRow>
      </YStack>
    </YStack>
  );
}
