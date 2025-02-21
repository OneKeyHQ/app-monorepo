import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import LimitOrderCard from '../../components/LimitOrderCard';

const LimitOrderCancelDialog = ({ item }: { item: IFetchLimitOrderRes }) => {
  const intl = useIntl();
  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <SizableText size="$bodyLg">
          {intl.formatMessage(
            {
              id: ETranslations.swap_page_limit_dialog_content,
            },
            {
              orderId: `${item.orderId.slice(0, 6)}...${item.orderId.slice(
                -4,
              )}`,
            },
          )}
        </SizableText>
      </YStack>
      <LimitOrderCard item={item} hiddenCancelIcon />
      <SizableText size="$bodyMd">
        {intl.formatMessage({
          id: ETranslations.limit_cancel_order_off_chain_tip,
        })}
      </SizableText>
    </YStack>
  );
};

export default LimitOrderCancelDialog;
