import { useIntl } from 'react-intl';

import {
  Accordion,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpsRecordToken } from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { TradingVolumeSummaryCard } from './TradingVolumeSummaryCard';

export interface IRecordsAccordionSectionItem {
  key: string;
  token: IPerpsRecordToken;
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
      <XStack ai="center" jc="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_friends_address,
          })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_order_reward,
          })}
        </SizableText>
      </XStack>
      <Accordion type="single" collapsible>
        {sections.map(({ key, accountAddress, fiatValue, items }) => (
          <Accordion.Item value={key} key={key}>
            <Accordion.Trigger
              unstyled
              flexDirection="row"
              alignItems="center"
              borderWidth={0}
              bg="$transparent"
              px="$2"
              py="$1"
              mx="$-2"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              borderRadius="$2"
            >
              {({ open }: { open: boolean }) => (
                <XStack
                  my="$3"
                  jc="space-between"
                  flex={1}
                  ai="center"
                  gap="$3"
                >
                  <SizableText
                    textAlign="left"
                    flex={1}
                    size="$bodyLgMedium"
                    color="$text"
                  >
                    {accountUtils.shortenAddress({
                      address: accountAddress,
                      leadingLength: 6,
                      trailingLength: 4,
                    })}
                  </SizableText>
                  <XStack ai="center" gap="$2">
                    <Currency
                      color="$textSuccess"
                      formatter="value"
                      size="$bodyLgMedium"
                      formatterOptions={{
                        showPlusMinusSigns: true,
                      }}
                    >
                      {fiatValue}
                    </Currency>
                    <Icon
                      size="$5"
                      name={
                        open
                          ? 'ChevronTopSmallOutline'
                          : 'ChevronDownSmallOutline'
                      }
                      color="$iconSubdued"
                    />
                  </XStack>
                </XStack>
              )}
            </Accordion.Trigger>
            <Accordion.HeightAnimator animation="quick">
              <Accordion.Content
                unstyled
                pt="$2"
                pb="$5"
                animation="100ms"
                enterStyle={{ opacity: 0 }}
                exitStyle={{ opacity: 0 }}
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
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        ))}
      </Accordion>
    </YStack>
  );
}
