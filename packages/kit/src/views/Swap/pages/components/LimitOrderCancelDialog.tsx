import { useIntl } from 'react-intl';

import { YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';

import LimitOrderCard from '../../components/LimitOrderCard';

const LimitOrderCancelDialog = ({ item }: { item: IFetchLimitOrderRes }) => {
  const intl = useIntl();
  const { gtMd } = useMedia();
  return (
    <YStack gap="$4">
      <LimitOrderCard
        item={item}
        hiddenCancelIcon
        hiddenHoverBg
        progressWidth={gtMd ? 120 : 100}
      />
      <HyperlinkText
        size="$bodyMd"
        color="$textSubdued"
        translationId={ETranslations.limit_cancel_order_off_chain_tip}
      ></HyperlinkText>
    </YStack>
  );
};

export default LimitOrderCancelDialog;
