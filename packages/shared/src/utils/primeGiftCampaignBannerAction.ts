import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import {
  type ILinkConfigItem,
  PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
} from '@onekeyhq/shared/types/linkConfig';

export function handlePrimeGiftCampaignBannerPress(
  item: Pick<ILinkConfigItem, 'linkId' | 'mode' | 'payload'>,
) {
  const handled = parseNotificationPayload(item.mode, item.payload, () => {});
  if (!handled) {
    return false;
  }
  defaultLogger.prime.subscription.primeGiftClaimSuccessBannerClick({
    slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
    linkId: item.linkId,
  });
  return true;
}
