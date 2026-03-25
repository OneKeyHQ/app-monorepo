import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ColorTokens } from '@onekeyhq/components';
import {
  Button,
  Icon,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EBulkSendTxStatus,
  type IBulkSendTxStatus,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

type IProps = {
  transferInfo: ITransferInfo;
  tokenInfo: IToken;
  status: IBulkSendTxStatus;
  networkId: string;
  tokenPrice?: number;
  onFillUp?: () => void;
};

function StatusDot({ color }: { color: ColorTokens }) {
  return <Stack width="$2" height="$2" bg={color} borderRadius="$full" />;
}

function BulkSendProcessItem(props: IProps) {
  const { transferInfo, tokenInfo, status, networkId, tokenPrice, onFillUp } =
    props;

  const intl = useIntl();
  const { copyText } = useClipboard();
  const [settings] = useSettingsPersistAtom();

  const shortenedFromAddress = useMemo(
    () =>
      accountUtils.shortenAddress({
        address: transferInfo.from,
        leadingLength: 6,
        trailingLength: 4,
      }),
    [transferInfo.from],
  );

  const shortenedToAddress = useMemo(
    () =>
      accountUtils.shortenAddress({
        address: transferInfo.to,
        leadingLength: 6,
        trailingLength: 4,
      }),
    [transferInfo.to],
  );

  const fiatAmount = useMemo(() => {
    if (!tokenPrice || !transferInfo.amount) return undefined;
    return new BigNumber(transferInfo.amount).times(tokenPrice).toFixed(2);
  }, [tokenPrice, transferInfo.amount]);

  const renderStatusIcon = useCallback(() => {
    switch (status.status) {
      case EBulkSendTxStatus.Processing:
        return <Spinner size="small" color="$iconSubdued" />;
      case EBulkSendTxStatus.Succeeded:
        return <StatusDot color="$iconSuccess" />;
      case EBulkSendTxStatus.Failed:
        return <StatusDot color="$iconCritical" />;
      case EBulkSendTxStatus.Skipped:
        return <StatusDot color="$iconInfo" />;
      case EBulkSendTxStatus.Pending:
      case EBulkSendTxStatus.Paused:
      default:
        return <StatusDot color="$iconCaution" />;
    }
  }, [status.status]);

  const renderStatusText = useCallback(() => {
    switch (status.status) {
      case EBulkSendTxStatus.Processing:
        return (
          <SizableText size="$bodySm" color="$textSubdued">
            Processing
          </SizableText>
        );
      case EBulkSendTxStatus.Succeeded:
        return (
          <XStack alignItems="center" gap="$1.5" maxWidth="100%">
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              {accountUtils.shortenAddress({
                address: status.txId ?? '',
                leadingLength: 8,
                trailingLength: 6,
              })}
            </SizableText>
            <IconButton
              icon="OpenOutline"
              variant="tertiary"
              size="small"
              iconColor="$iconSubdued"
              onPress={() =>
                openTransactionDetailsUrl({
                  networkId,
                  txid: status.txId,
                  openInExternal: true,
                })
              }
            />
            <IconButton
              icon="Copy3Outline"
              variant="tertiary"
              size="small"
              iconColor="$iconSubdued"
              onPress={() => copyText(status.txId ?? '')}
            />
          </XStack>
        );
      case EBulkSendTxStatus.Failed:
        return (
          <XStack alignItems="center" gap="$1.5" maxWidth="100%">
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              {intl.formatMessage({
                id: ETranslations.wallet_approval_bulk_revoke_status_failed,
              })}
            </SizableText>
            {status.errorMessage ? (
              <Popover
                title="Error"
                renderTrigger={
                  <IconButton
                    size="small"
                    icon="InfoCircleOutline"
                    variant="tertiary"
                    iconColor="$iconSubdued"
                  />
                }
                renderContent={({ closePopover }) => (
                  <XStack p="$5" alignItems="center" gap="$1" flex={1}>
                    <SizableText size="$bodyLg" flex={1}>
                      {status.errorMessage}
                    </SizableText>
                    {status.isInsufficientFunds && onFillUp ? (
                      <Button
                        variant="tertiary"
                        size="large"
                        color="$textInfo"
                        onPress={() => {
                          onFillUp();
                          closePopover();
                        }}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_fill_up,
                        })}
                      </Button>
                    ) : null}
                  </XStack>
                )}
              />
            ) : null}
          </XStack>
        );
      case EBulkSendTxStatus.Skipped:
        return (
          <XStack alignItems="center" gap="$1.5" maxWidth="100%">
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              Skipped
            </SizableText>
            {status.errorMessage ? (
              <Popover
                title="Skipped"
                renderTrigger={
                  <IconButton
                    size="small"
                    icon="InfoCircleOutline"
                    variant="tertiary"
                    iconColor="$iconSubdued"
                  />
                }
                renderContent={() => (
                  <XStack p="$5" alignItems="center" gap="$1" flex={1}>
                    <SizableText size="$bodyLg" flex={1}>
                      {status.errorMessage}
                    </SizableText>
                  </XStack>
                )}
              />
            ) : null}
          </XStack>
        );
      case EBulkSendTxStatus.Pending:
      case EBulkSendTxStatus.Paused:
      default:
        return (
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_pending })}
          </SizableText>
        );
    }
  }, [status, networkId, copyText, intl, onFillUp]);

  return (
    <XStack py="$4" px="$5" justifyContent="space-between" alignItems="center">
      {/* Left: sender + receiver */}
      <YStack gap="$1.5" flex={1} mr="$5" justifyContent="center" minWidth={0}>
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {shortenedFromAddress}
        </SizableText>
        <XStack alignItems="center" gap="$2">
          <Icon name="ArrowRightCircleOutline" size="$4" color="$iconSubdued" />
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {shortenedToAddress}
          </SizableText>
        </XStack>
      </YStack>

      {/* Right: amount + status */}
      <YStack alignItems="flex-end" gap="$1.5" justifyContent="center">
        <XStack alignItems="center" gap="$1" justifyContent="flex-end">
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="balance"
            formatterOptions={{ tokenSymbol: tokenInfo.symbol }}
            numberOfLines={1}
          >
            {transferInfo.amount || '0'}
          </NumberSizeableText>
          {fiatAmount ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              (
              <NumberSizeableText
                size="$bodyMd"
                formatter="value"
                formatterOptions={{
                  currency: settings.currencyInfo.symbol,
                }}
                numberOfLines={1}
              >
                {fiatAmount}
              </NumberSizeableText>
              )
            </SizableText>
          ) : null}
        </XStack>
        <XStack alignItems="center" gap="$2" justifyContent="flex-end">
          {renderStatusIcon()}
          {renderStatusText()}
        </XStack>
      </YStack>
    </XStack>
  );
}

export default memo(BulkSendProcessItem);
