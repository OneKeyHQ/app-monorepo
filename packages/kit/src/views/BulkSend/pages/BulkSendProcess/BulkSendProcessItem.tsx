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
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EBulkSendTxStatus,
  type IBulkSendTxStatus,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';

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

  const fiatAmount = useMemo(() => {
    if (!tokenPrice || !transferInfo.amount) return undefined;
    return new BigNumber(transferInfo.amount).times(tokenPrice).toFixed(2);
  }, [tokenPrice, transferInfo.amount]);

  const renderStatusIcon = useCallback(() => {
    switch (status.status) {
      case EBulkSendTxStatus.Processing:
        return <Spinner size="small" />;
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
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodySm" color="$textSuccess">
              {accountUtils.shortenAddress({
                address: status.txId ?? '',
                leadingLength: 6,
                trailingLength: 5,
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
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodySm" color="$textCritical">
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
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
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
          <SizableText size="$bodySm" color="$textCaution">
            {intl.formatMessage({ id: ETranslations.global_pending })}
          </SizableText>
        );
    }
  }, [status, networkId, copyText, intl, onFillUp]);

  return (
    <XStack
      py="$3"
      px="$5"
      justifyContent="space-between"
      alignItems="flex-start"
      borderBottomWidth={1}
      borderColor="$neutral3"
    >
      {/* Left: sender + receiver */}
      <YStack gap="$1" flex={1} mr="$3">
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {accountUtils.shortenAddress({ address: transferInfo.from })}
        </SizableText>
        <XStack alignItems="center" gap="$1">
          <Icon
            name="ArrowBottomLeftOutline"
            size="$3.5"
            color="$iconSubdued"
          />
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {accountUtils.shortenAddress({ address: transferInfo.to })}
          </SizableText>
        </XStack>
      </YStack>

      {/* Right: amount + status */}
      <YStack alignItems="flex-end" gap="$1">
        <XStack alignItems="center" gap="$1">
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
        <XStack alignItems="center" gap="$1">
          {renderStatusIcon()}
          {renderStatusText()}
        </XStack>
      </YStack>
    </XStack>
  );
}

export default memo(BulkSendProcessItem);
