import { XStack } from '@onekeyhq/components';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import type {
  IBorrowReserveDetail,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { DetailsSectionContainer } from './DetailsSectionContainer';

const fallbackText: IEarnText = { text: '-' };

export function DailyCapsSection({
  details,
}: {
  details?: IBorrowReserveDetail;
}) {
  if (!details) {
    return null;
  }

  const dailyInfo = details.dailyInfo;

  const items = [
    {
      key: 'dailyBorrowCap',
      title: 'Daily borrow cap',
      description: dailyInfo?.borrowCapacity ?? fallbackText,
    },
    {
      key: 'borrowableToday',
      title: 'Borrowable today',
      description: dailyInfo?.borrowable ?? fallbackText,
    },
    {
      key: 'borrowCapResetsIn',
      title: 'Daily cap resets in',
      description: dailyInfo?.borrowCapResetRemainingTime ?? fallbackText,
    },
    {
      key: 'dailyWithdrawCap',
      title: 'Daily withdraw cap',
      description: dailyInfo?.withdrawCapacity ?? fallbackText,
    },
    {
      key: 'withdrawableToday',
      title: 'Withdrawable today',
      description: dailyInfo?.withdrawable ?? fallbackText,
    },
    {
      key: 'withdrawCapResetsIn',
      title: 'Daily cap resets in',
      description: dailyInfo?.withdrawCapResetRemainingTime ?? fallbackText,
    },
  ];

  return (
    <DetailsSectionContainer title="Daily caps">
      <XStack flexWrap="wrap" m="$-5" p="$2">
        {items.map((item) => (
          <GridItem
            key={item.key}
            title={{ text: item.title }}
            description={item.description}
          />
        ))}
      </XStack>
    </DetailsSectionContainer>
  );
}
