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
import { DescriptionItem } from '@onekeyhq/kit/src/components/DescriptionItem';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { RedemptionTestIDs } from '@onekeyhq/kit/src/views/Redemption/testIDs';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBtcRewardHistoryItem } from '@onekeyhq/shared/src/referralCode/type';
import { EBtcRewardStatus } from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import {
  formatBtcRewardServerDate,
  formatUsd,
  getBtcRewardStatusConfig,
  isBtcRewardSnapshotStatus,
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
          testID={RedemptionTestIDs.btcRewardCopyBtn}
          variant="tertiary"
          size="small"
          icon="Copy3Outline"
          onPress={onCopy}
          title={copyTitle}
        />
        {onOpenExplorer ? (
          <IconButton
            testID={RedemptionTestIDs.btcRewardOpenExplorerBtn}
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
  const hasBtcSnapshot = isBtcRewardSnapshotStatus(item.status);
  const btcAmount = hasBtcSnapshot ? item.btcAmount : undefined;
  const btcPriceUsd = hasBtcSnapshot ? item.btcPriceUsd : undefined;
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
            {btcAmount ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
              >
                {intl.formatMessage(
                  { id: ETranslations.redemption_btc_amount_on_base },
                  { amount: btcAmount },
                )}
              </SizableText>
            ) : null}
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
            <DescriptionItem
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_label_code,
              })}
              value={item.code}
            />

            <DescriptionItem
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_verify_order_input_label,
              })}
              value={item.voucherCode}
            />

            {btcPriceUsd ? (
              <DescriptionItem
                label={intl.formatMessage({
                  id: ETranslations.redemption_btc_label_btc_price,
                })}
                value={formatUsd(btcPriceUsd)}
              />
            ) : null}

            <DescriptionItem
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_label_submitted,
              })}
              value={formatDate(item.submittedAt)}
            />

            {item.status !== EBtcRewardStatus.Paid &&
            item.status !== EBtcRewardStatus.Rejected &&
            item.expectedPayoutAt ? (
              <DescriptionItem
                label={intl.formatMessage({
                  id: ETranslations.redemption_btc_success_eligible_label_title,
                })}
                value={formatBtcRewardServerDate(item.expectedPayoutAt)}
              />
            ) : null}

            {isPaid && item.paidAt ? (
              <DescriptionItem
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
