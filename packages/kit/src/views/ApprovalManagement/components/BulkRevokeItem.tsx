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
  Stack,
  View,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';
import {
  ERevokeTxStatus,
  type IRevokeTxStatus,
} from '@onekeyhq/shared/types/approval';

import { Token } from '../../../components/Token';
import { openExplorerAddressUrl } from '../../../utils/explorerUtils';

import type { IntlShape } from 'react-intl';

type IProps = {
  unsignedTx: IUnsignedTxPro;
  revokeTxsStatusMap: Record<string, IRevokeTxStatus>;
  contractMap: Record<string, IAddressInfo>;
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

  return <Stack width="$2" height="$2" bg={iconColor} borderRadius="$full" />;
}

function BulkRevokeItem(props: IProps) {
  const { unsignedTx, revokeTxsStatusMap, contractMap } = props;

  const intl = useIntl();

  const { copyText } = useClipboard();

  const approveInfo = unsignedTx.approveInfo;

  const contract = contractMap[
    approvalUtils.buildContractMapKey({
      networkId: unsignedTx?.networkId ?? '',
      contractAddress: approveInfo?.spender ?? '',
    })
  ] ?? {
    label: intl.formatMessage({ id: ETranslations.global_unknown }),
    icon: 'Document2Outline',
  };

  const status = useMemo(() => {
    return (
      revokeTxsStatusMap[unsignedTx.uuid ?? ''] ?? {
        status: ERevokeTxStatus.Pending,
      }
    );
  }, [revokeTxsStatusMap, unsignedTx.uuid]);

  const [settings] = useSettingsPersistAtom();

  const renderRevokeStatus = useCallback(() => {
    return (
      <YStack flex={1} justifyContent="flex-end">
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
          </SizableText>
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
                <Stack p="$5">
                  <SizableText size="$bodyLg">
                    {status.skippedReason}
                  </SizableText>
                </Stack>
              }
            />
          ) : null}
        </XStack>
      </YStack>
    );
  }, [status, settings.currencyInfo.symbol, intl]);

  if (!approveInfo) {
    return null;
  }

  return (
    <Accordion.Item value={unsignedTx.uuid ?? ''}>
      <Accordion.Trigger
        flexDirection="row"
        justifyContent="space-between"
        borderTopWidth={0}
        borderLeftWidth={0}
        borderRightWidth={0}
        borderColor="$neutral3"
        minHeight="108"
        px="$5"
      >
        {({ open }: { open: boolean }) => (
          <XStack alignItems="center" gap="$3" flex={1}>
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
              <XStack
                alignItems="center"
                gap="$3"
                flex={1}
                justifyContent="space-between"
              >
                <YStack flex={1}>
                  <SizableText
                    size="$bodyLgMedium"
                    numberOfLines={1}
                    flex={1}
                    textAlign="left"
                  >
                    {approveInfo.tokenInfo?.symbol}
                  </SizableText>
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    numberOfLines={1}
                    flex={1}
                    textAlign="left"
                  >
                    {contract.label}
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
          padding="$0"
        >
          <YStack gap="$4" px="$5" py="$5">
            <XStack alignItems="flex-start" justifyContent="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.wallet_approval_bulk_revoke_approved_spender,
                })}
              </SizableText>
              <XStack alignItems="center" gap="$2">
                <YStack alignItems="flex-end">
                  <SizableText size="$bodyMdMedium">
                    {contract.label}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {accountUtils.shortenAddress({
                      address: approveInfo.spender,
                      leadingLength: 8,
                      trailingLength: 6,
                    })}
                  </SizableText>
                </YStack>
                <IconButton
                  title={intl.formatMessage({
                    id: ETranslations.global_copy,
                  })}
                  icon="Copy3Outline"
                  variant="tertiary"
                  size="small"
                  color="$iconSubdued"
                  onPress={() => copyText(approveInfo.spender)}
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
                    title={intl.formatMessage({
                      id: ETranslations.global_view_in_blockchain_explorer,
                    })}
                    variant="tertiary"
                    icon="OpenOutline"
                    iconColor="$iconSubdued"
                    size="small"
                    onPress={() =>
                      openExplorerAddressUrl({
                        networkId: unsignedTx.networkId,
                        address: status.txId,
                        openInExternal: true,
                      })
                    }
                  />
                  <IconButton
                    title={intl.formatMessage({
                      id: ETranslations.global_copy,
                    })}
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
