import { useIntl } from 'react-intl';

import { Accordion, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IRewardToken } from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsAccordionItem } from '../../ReferFriendsAccordionItem';
import { ReferFriendsListHeader } from '../../ReferFriendsListHeader';

import { TradingVolumeSummaryCard } from './TradingVolumeSummaryCard';

export interface IRecordsAccordionSectionItem {
  key: string;
  token: IRewardToken;
  amount: string;
  fiatValue: string;
  tradingVolume: string;
  tradingVolumeFiatValue: string;
}

export interface IRecordsAccordionSection {
  key: string;
  accountAddress: string;
  fiatValue: string;
  items: IRecordsAccordionSectionItem[];
}

interface IRecordsAccordionListProps {
  sections: IRecordsAccordionSection[];
}

export function RecordsAccordionList({ sections }: IRecordsAccordionListProps) {
  const intl = useIntl();
  const tradingVolumeTitle = intl.formatMessage({
    id: ETranslations.perp_trades_history_title,
    defaultMessage: 'Trading Volume',
  });
  return (
    <YStack gap="$2">
      <ReferFriendsListHeader />
      <Accordion type="single" collapsible>
        {sections.map(({ key, accountAddress, fiatValue, items }) => (
          <ReferFriendsAccordionItem
            key={key}
            value={key}
            accountAddress={accountAddress}
            fiatValue={fiatValue}
          >
            <YStack gap="$3">
              {items.map((item) => (
                <TradingVolumeSummaryCard
                  key={item.key}
                  title={tradingVolumeTitle}
                  totalFiatValue={item.tradingVolumeFiatValue}
                  token={item.token}
                  tokenAmount={item.amount}
                  tokenFiatValue={item.fiatValue}
                />
              ))}
            </YStack>
          </ReferFriendsAccordionItem>
        ))}
      </Accordion>
    </YStack>
  );
}
