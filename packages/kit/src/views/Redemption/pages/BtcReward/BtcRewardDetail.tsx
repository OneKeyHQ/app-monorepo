import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Badge,
  Divider,
  IconButton,
  Page,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBtcRewardHistoryItem } from '@onekeyhq/shared/src/referralCode/type';
import { EBtcRewardStatus } from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import {
  formatUsd,
  getBtcRewardPayoutDate,
  getBtcRewardStatusConfig,
} from '../../utils';

import type { RouteProp } from '@react-navigation/core';

type IRouteParams = RouteProp<
  {
    BtcRewardDetail: {
      item: IBtcRewardHistoryItem;
    };
  },
  'BtcRewardDetail'
>;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium" textAlign="right" flexShrink={1}>
        {value}
      </SizableText>
    </XStack>
  );
}

function HashRow({
  label,
  value,
  onCopy,
  copyTitle,
  onOpenExplorer,
  openExplorerTitle,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copyTitle: string;
  onOpenExplorer?: () => void;
  openExplorerTitle?: string;
}) {
  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$2">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <XStack gap="$1" alignItems="center" flexShrink={1}>
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {accountUtils.shortenAddress({ address: value })}
        </SizableText>
        <IconButton
          variant="tertiary"
          size="small"
          icon="Copy3Outline"
          onPress={onCopy}
          title={copyTitle}
        />
        {onOpenExplorer ? (
          <IconButton
            variant="tertiary"
            size="small"
            icon="OpenOutline"
            onPress={onOpenExplorer}
            title={openExplorerTitle}
          />
        ) : null}
      </XStack>
    </XStack>
  );
}

function BtcRewardDetailPage() {
  const intl = useIntl();
  const route = useRoute<IRouteParams>();
  const { item } = route.params;
  const { copyText } = useClipboard();

  const statusConfigs = useMemo(() => getBtcRewardStatusConfig(intl), [intl]);
  const title = intl.formatMessage({
    id: ETranslations.redemption_btc_detail_title,
  });

  const handleCopyAddress = useCallback(() => {
    copyText(item.walletAddress);
  }, [item.walletAddress, copyText]);

  const handleCopyTxHash = useCallback(() => {
    copyText(item.txHash);
  }, [item.txHash, copyText]);

  const handleViewOnBaseScan = useCallback(() => {
    void openTransactionDetailsUrl({
      networkId: getNetworkIdsMap().base,
      txid: item.txHash,
    });
  }, [item.txHash]);

  const statusConfig =
    statusConfigs[item.status] ?? statusConfigs[EBtcRewardStatus.Wait];
  const isPaid = item.status === EBtcRewardStatus.Paid;
  // OAS marks these fields required, but the server uses empty string when
  // the field is not applicable to the current status — guard before render.
  const rejectReason =
    item.status === EBtcRewardStatus.Rejected && item.rejectReason
      ? item.rejectReason
      : null;

  return (
    <Page scrollEnabled>
      <Page.Header title={title} />
      <Page.Body px="$5" py="$4">
        <YStack gap="$4">
          <YStack alignItems="center" py="$4" gap="$2">
            <Badge badgeType={statusConfig.badgeType} badgeSize="lg">
              <Badge.Text>{statusConfig.label}</Badge.Text>
            </Badge>
            <SizableText size="$heading4xl" textAlign="center" pt="$2">
              {formatUsd(item.rewardUsd)}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
              {intl.formatMessage(
                { id: ETranslations.redemption_btc_amount_on_base },
                { amount: item.btcAmount },
              )}
            </SizableText>
            <SizableText
              size="$bodyMd"
              color={rejectReason ? '$textCritical' : '$textSubdued'}
              textAlign="center"
              pt="$1"
            >
              {rejectReason ?? statusConfig.description}
            </SizableText>
          </YStack>

          <YStack bg="$bgSubdued" borderRadius="$3" p="$4" gap="$3">
            <DetailRow
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_label_product,
              })}
              value={item.batchName}
            />

            <DetailRow
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_label_code,
              })}
              value={item.code}
            />

            <DetailRow
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_verify_order_input_label,
              })}
              value={item.voucherCode}
            />

            <DetailRow
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_label_btc_price_locked,
              })}
              value={formatUsd(item.btcPriceUsd)}
            />

            <DetailRow
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_label_submitted,
              })}
              value={formatDate(item.submittedAt)}
            />

            {item.status !== EBtcRewardStatus.Paid &&
            item.status !== EBtcRewardStatus.Rejected ? (
              <DetailRow
                label={intl.formatMessage({
                  id: ETranslations.redemption_btc_success_eligible_label_title,
                })}
                value={formatDate(
                  getBtcRewardPayoutDate(item.payoutEligibleAt),
                  {
                    hideTimeForever: true,
                  },
                )}
              />
            ) : null}

            {isPaid && item.paidAt ? (
              <DetailRow
                label={intl.formatMessage({
                  id: ETranslations.referral_distributed,
                })}
                value={formatDate(item.paidAt)}
              />
            ) : null}

            <Divider />
            <HashRow
              label={intl.formatMessage({
                id: ETranslations.referral_reward_received_address,
              })}
              value={item.walletAddress}
              onCopy={handleCopyAddress}
              copyTitle={intl.formatMessage({
                id: ETranslations.global_copy_address,
              })}
            />

            {isPaid && item.txHash ? (
              <HashRow
                label={intl.formatMessage({
                  id: ETranslations.global_transaction_id,
                })}
                value={item.txHash}
                onCopy={handleCopyTxHash}
                copyTitle={intl.formatMessage({
                  id: ETranslations.redemption_btc_detail_copy_tx_hash,
                })}
                onOpenExplorer={handleViewOnBaseScan}
                openExplorerTitle={intl.formatMessage({
                  id: ETranslations.global_view_in_blockchain_explorer,
                })}
              />
            ) : null}
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default BtcRewardDetailPage;
