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
    dailyBorrowCap: intl.formatMessage({
      id: ETranslations.defi_daily_borrow_cap,
    }),
    borrowableToday: intl.formatMessage({
      id: ETranslations.defi_borrowable_today,
    }),
    borrowCapResetsIn: intl.formatMessage({
      id: ETranslations.defi_borrow_cap_resets_in,
    }),
    dailyWithdrawCap: intl.formatMessage({
      id: ETranslations.defi_daily_withdraw_cap,
    }),
    withdrawableToday: intl.formatMessage({
      id: ETranslations.defi_withdrawable_today,
    }),
    withdrawCapResetsIn: intl.formatMessage({
      id: ETranslations.defi_withdraw_cap_resets_in,
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
      title: labels.borrowCapResetsIn,
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
      title: labels.withdrawCapResetsIn,
      description: dailyInfo?.withdrawCapResetRemainingTime ?? fallbackText,
    },
  ];

  return (
    <DetailsSectionContainer
      title={intl.formatMessage({ id: ETranslations.defi_daily_caps })}
    >
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
