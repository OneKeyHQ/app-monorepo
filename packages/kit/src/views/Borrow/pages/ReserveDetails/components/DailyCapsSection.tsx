import { useIntl } from 'react-intl';

import { XStack } from '@onekeyhq/components';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();

  if (!details) {
    return null;
  }

  const dailyInfo = details.dailyInfo;
  const labels = {
    dailyCaps: intl.formatMessage({ id: ETranslations.defi_daily_caps }),
    dailyBorrowCap: intl.formatMessage({
      id: ETranslations.defi_daily_borrow_cap,
    }),
    borrowableToday: intl.formatMessage({
      id: ETranslations.defi_borrowable_today,
    }),
    dailyCapResetsIn: intl.formatMessage({
      id: ETranslations.defi_daily_cap_resets_in,
    }),
    dailyWithdrawCap: intl.formatMessage({
      id: ETranslations.defi_daily_withdraw_cap,
    }),
    withdrawableToday: intl.formatMessage({
      id: ETranslations.defi_withdrawable_today,
    }),
  };

  const items = [
    {
      key: 'dailyBorrowCap',
      title: labels.dailyBorrowCap,
      description: dailyInfo?.borrowCapacity ?? fallbackText,
    },
    {
      key: 'borrowableToday',
      title: labels.borrowableToday,
      description: dailyInfo?.borrowable ?? fallbackText,
    },
    {
      key: 'borrowCapResetsIn',
      title: labels.dailyCapResetsIn,
      description: dailyInfo?.borrowCapResetRemainingTime ?? fallbackText,
    },
    {
      key: 'dailyWithdrawCap',
      title: labels.dailyWithdrawCap,
      description: dailyInfo?.withdrawCapacity ?? fallbackText,
    },
    {
      key: 'withdrawableToday',
      title: labels.withdrawableToday,
      description: dailyInfo?.withdrawable ?? fallbackText,
    },
    {
      key: 'withdrawCapResetsIn',
      title: labels.dailyCapResetsIn,
      description: dailyInfo?.withdrawCapResetRemainingTime ?? fallbackText,
    },
  ];

  return (
    <DetailsSectionContainer title={labels.dailyCaps}>
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
