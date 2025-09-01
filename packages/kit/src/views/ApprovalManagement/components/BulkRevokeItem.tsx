import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens } from '@onekeyhq/components';
import {
  Accordion,
  Icon,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  Spinner,
  View,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  ERevokeTxStatus,
  type IRevokeTxStatus,
} from '@onekeyhq/shared/types/approval';

import { Token } from '../../../components/Token';

import type { IntlShape } from 'react-intl';

type IProps = {
  unsignedTx: IUnsignedTxPro;
  revokeTxsStatusMap: Record<string, IRevokeTxStatus>;
};

function getRevokeStatusLabel({
  intl,
  status,
}: {
  intl: IntlShape;
  status: ERevokeTxStatus;
}) {
  switch (status) {
    case ERevokeTxStatus.Processing:
      return intl.formatMessage({
        id: ETranslations.approval_bulk_revoke_status_processing,
      });
    case ERevokeTxStatus.Succeeded:
      return intl.formatMessage({
        id: ETranslations.wallet_approval_bulk_revoke_status_succeeded,
      });
    case ERevokeTxStatus.Pending:
      return intl.formatMessage({
        id: ETranslations.global_pending,
      });
    case ERevokeTxStatus.Paused:
      return intl.formatMessage({
        id: ETranslations.wallet_approval_bulk_revoke_status_paused,
      });
    case ERevokeTxStatus.Skipped:
      return intl.formatMessage({
        id: ETranslations.wallet_approval_bulk_revoke_status_skipped,
      });
    default:
      return '';
  }
}

function RevokeStatusIcon(props: { status: IRevokeTxStatus }) {
  const { status } = props;

  let iconColor: ColorTokens = '$icon';

  if (status.status === ERevokeTxStatus.Processing) {
    return <Spinner size="small" />;
  }

  if (status.status === ERevokeTxStatus.Succeeded) {
    iconColor = '$iconSuccess';
  } else if (
    status.status === ERevokeTxStatus.Pending ||
    status.status === ERevokeTxStatus.Paused
  ) {
    iconColor = '$iconCaution';
  } else if (status.status === ERevokeTxStatus.Skipped) {
    iconColor = '$iconInfo';
  }

  return <Icon name="CheckRadioSolid" color={iconColor} />;
}

function BulkRevokeItem(props: IProps) {
  const { unsignedTx, revokeTxsStatusMap } = props;

  const { copyText } = useClipboard();

  const status = useMemo(() => {
    return (
      revokeTxsStatusMap[unsignedTx.uuid ?? ''] ?? {
        status: ERevokeTxStatus.Pending,
      }
    );
  }, [revokeTxsStatusMap, unsignedTx.uuid]);

  const approveInfo = unsignedTx.approveInfo;

  const intl = useIntl();

  const [settings] = useSettingsPersistAtom();

  const renderRevokeStatus = useCallback(() => {
    return (
      <YStack flex={1}>
        {status.status === ERevokeTxStatus.Succeeded ? (
          <XStack alignItems="center" gap="$1" justifyContent="flex-end">
            <NumberSizeableText
              size="$bodyMdMedium"
              formatter="balance"
              formatterOptions={{
                tokenSymbol: status.feeSymbol,
              }}
            >
              {status.feeBalance ?? '-'}
            </NumberSizeableText>
            <SizableText size="$bodyMdMedium">
              (
              <NumberSizeableText
                size="$bodyMdMedium"
                formatter="value"
                formatterOptions={{
                  currency: settings.currencyInfo.symbol,
                }}
              >
                {status.feeFiat ?? '-'}
              </NumberSizeableText>
              )
            </SizableText>
          </XStack>
        ) : null}
        <XStack alignItems="center" gap="$2" justifyContent="flex-end">
          <RevokeStatusIcon status={status} />
          <SizableText size="$bodyMd" color="$text">
            {getRevokeStatusLabel({
              intl,
              status: status.status,
            })}
            {status.skippedReason ? (
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.approval_bulk_revoke_status_paused_reason_description,
                })}
                renderTrigger={
                  <IconButton
                    size="small"
                    color="$iconSubdued"
                    icon="InfoCircleOutline"
                    variant="tertiary"
                  />
                }
                renderContent={
                  <SizableText size="$bodyLg">
                    {status.skippedReason}
                  </SizableText>
                }
              />
            ) : null}
          </SizableText>
        </XStack>
      </YStack>
    );
  }, [status, settings.currencyInfo.symbol, intl]);

  if (!approveInfo) {
    return null;
  }

  return (
    <Accordion.Item value={unsignedTx.uuid ?? ''}>
      <Accordion.Trigger flexDirection="row" justifyContent="space-between">
        {({ open }: { open: boolean }) => (
          <XStack alignItems="center" gap="$3">
            <View
              animation="quick"
              rotate={open ? '180deg' : '0deg'}
              transformOrigin="center"
            >
              <Icon
                name="ChevronDownSmallOutline"
                color="$iconSubdued"
                size="$6"
              />
            </View>
            <XStack alignItems="center" gap="$3" flex={1}>
              <Token
                size="md"
                showNetworkIcon
                tokenImageUri={approveInfo.tokenInfo?.logoURI}
                networkId={
                  approveInfo.tokenInfo?.networkId ?? unsignedTx.networkId
                }
              />
              <XStack alignItems="center" gap="$3" flex={1}>
                <YStack flex={1}>
                  <SizableText size="$bodyLgMedium" numberOfLines={1}>
                    {approveInfo.tokenInfo?.symbol}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {approveInfo.tokenInfo?.networkId}
                  </SizableText>
                </YStack>
                {renderRevokeStatus()}
              </XStack>
            </XStack>
          </XStack>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          animation="quick"
          exitStyle={{ opacity: 0 }}
          backgroundColor="$bgSubdued"
        >
          <YStack gap="$4">
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.wallet_approval_bulk_revoke_approved_spender,
                })}
              </SizableText>
              <XStack alignItems="center" gap="$2">
                <YStack>
                  <SizableText size="$bodyMdMedium">
                    {approveInfo.owner}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {accountUtils.shortenAddress({
                      address: approveInfo.owner,
                      leadingLength: 8,
                      trailingLength: 6,
                    })}
                  </SizableText>
                </YStack>
                <IconButton
                  icon="Copy3Outline"
                  variant="tertiary"
                  size="small"
                  color="$iconSubdued"
                  onPress={() => copyText(approveInfo.owner)}
                />
              </XStack>
            </XStack>
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.global_transaction_id,
                })}
              </SizableText>
              {status.txId ? (
                <XStack alignItems="center" gap="$2" justifyContent="flex-end">
                  <SizableText size="$bodyMdMedium">
                    {accountUtils.shortenAddress({
                      address: status.txId,
                      leadingLength: 8,
                      trailingLength: 6,
                    })}
                  </SizableText>
                  <IconButton
                    icon="Copy3Outline"
                    variant="tertiary"
                    size="small"
                    color="$iconSubdued"
                    onPress={() => copyText(status.txId ?? '')}
                  />
                </XStack>
              ) : (
                <SizableText
                  size="$bodyMdMedium"
                  color="$textSubdued"
                  textAlign="right"
                >
                  -
                </SizableText>
              )}
            </XStack>
          </YStack>
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}

export default memo(BulkRevokeItem);
