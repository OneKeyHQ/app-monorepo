import { useIntl } from 'react-intl';

import { SimpleTabs } from '@onekeyhq/kit/src/views/ReferFriends/components/SimpleTabs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export enum ERecordsTabValue {
  available = 'available',
  total = 'total',
}

interface IRecordsTabSwitcherProps {
  value: ERecordsTabValue;
  onChange: (value: ERecordsTabValue) => void;
}

export function RecordsTabSwitcher({
  value,
  onChange,
}: IRecordsTabSwitcherProps) {
  const intl = useIntl();
  const tabs = [
    {
      value: ERecordsTabValue.available,
      label: intl.formatMessage({
        id: ETranslations.earn_referral_undistributed,
      }),
    },
    {
      value: ERecordsTabValue.total,
      label: intl.formatMessage({
        id: ETranslations.referral_referred_total,
      }),
    },
  ];

  return (
    <SimpleTabs
      value={value}
      onChange={onChange}
      tabs={tabs}
      containerStyle={{ gap: '$2' }}
    />
  );
}
