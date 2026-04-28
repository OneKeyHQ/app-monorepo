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
    if (item.walletAddress) {
      copyText(item.walletAddress);
    }
  }, [item.walletAddress, copyText]);

  const handleCopyTxHash = useCallback(() => {
    if (item.txHash) {
      copyText(item.txHash);
    }
  }, [item.txHash, copyText]);

  const handleViewOnBaseScan = useCallback(() => {
    if (item.txHash) {
      void openTransactionDetailsUrl({
        networkId: getNetworkIdsMap().base,
        txid: item.txHash,
      });
    }
  }, [item.txHash]);

  const statusConfig =
    statusConfigs[item.status] ?? statusConfigs[EBtcRewardStatus.Wait];
  const isPaid = item.status === EBtcRewardStatus.Paid;
  const rejectReason =
    item.status === EBtcRewardStatus.Rejected ? item.rejectReason : null;

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
              {formatUsd(item.rewardUsdCents / 100)}
            </SizableText>
            {item.btcAmount ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
              >
                {intl.formatMessage(
                  { id: ETranslations.redemption_btc_amount_on_base },
                  { amount: item.btcAmount },
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
            <DetailRow
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_label_product,
              })}
              value={item.modelLabel}
            />

            {item.activityName ? (
              <DetailRow
                label={intl.formatMessage({
                  id: ETranslations.redemption_btc_label_activity_title,
                })}
                value={item.activityName}
              />
            ) : null}

            <DetailRow
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_label_code,
              })}
              value={item.code}
            />

            {item.btcPriceUsd ? (
              <DetailRow
                label={intl.formatMessage({
                  id: ETranslations.redemption_btc_label_btc_price_locked,
                })}
                value={formatUsd(item.btcPriceUsd)}
              />
            ) : null}

            {item.submittedAt ? (
              <DetailRow
                label={intl.formatMessage({
                  id: ETranslations.redemption_btc_label_submitted,
                })}
                value={formatDate(item.submittedAt)}
              />
            ) : null}

            {item.payoutEligibleAt &&
            item.status !== EBtcRewardStatus.Paid &&
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

            {item.walletAddress ? (
              <>
                <Divider />
                <XStack
                  justifyContent="space-between"
                  alignItems="center"
                  gap="$2"
                >
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.referral_reward_received_address,
                    })}
                  </SizableText>
                  <XStack gap="$1" alignItems="center" flexShrink={1}>
                    <SizableText size="$bodyMdMedium" numberOfLines={1}>
                      {accountUtils.shortenAddress({
                        address: item.walletAddress,
                      })}
                    </SizableText>
                    <IconButton
                      variant="tertiary"
                      size="small"
                      icon="Copy3Outline"
                      onPress={handleCopyAddress}
                      title={intl.formatMessage({
                        id: ETranslations.global_copy_address,
                      })}
                    />
                  </XStack>
                </XStack>
              </>
            ) : null}

            {isPaid && item.txHash ? (
              <XStack
                justifyContent="space-between"
                alignItems="center"
                gap="$2"
              >
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.global_transaction_id,
                  })}
                </SizableText>
                <XStack gap="$1" alignItems="center" flexShrink={1}>
                  <SizableText size="$bodyMdMedium" numberOfLines={1}>
                    {accountUtils.shortenAddress({ address: item.txHash })}
                  </SizableText>
                  <IconButton
                    variant="tertiary"
                    size="small"
                    icon="Copy3Outline"
                    onPress={handleCopyTxHash}
                    title={intl.formatMessage({
                      id: ETranslations.redemption_btc_detail_copy_tx_hash,
                    })}
                  />
                  <IconButton
                    variant="tertiary"
                    size="small"
                    icon="OpenOutline"
                    onPress={handleViewOnBaseScan}
                    title={intl.formatMessage({
                      id: ETranslations.global_view_in_blockchain_explorer,
                    })}
                  />
                </XStack>
              </XStack>
            ) : null}
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default BtcRewardDetailPage;
