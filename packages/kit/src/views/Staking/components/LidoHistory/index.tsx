import { useCallback, useMemo } from 'react';

import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Empty,
  NumberSizeableText,
  SectionList,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { ILidoHistoryItem } from '@onekeyhq/shared/types/staking';

type ILidoHistoryProps = {
  items: ILidoHistoryItem[];
};

export const LidoHistory = ({ items }: ILidoHistoryProps) => {
  const sections = useMemo(() => {
    const result = groupBy(items, (item) =>
      formatDate(new Date(item.timestamp * 1000), { hideTimeForever: true }),
    );
    return Object.entries(result)
      .map(([title, data]) => ({ title, data }))
      .sort((a, b) => b.data[0].timestamp - a.data[0].timestamp);
  }, [items]);

  const renderItem = useCallback(
    ({ item }: { item: ILidoHistoryItem }) => (
      <ListItem
        avatarProps={{
          src: item.receive?.token.logoURI ?? item.send?.token.logoURI,
        }}
        title={item.label}
        subtitle="Lido"
      >
        <YStack alignItems="flex-end">
          {item.receive ? (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="balance"
              formatterOptions={{ tokenSymbol: item.receive.token.symbol }}
            >
              {`+${item.receive.amount}`}
            </NumberSizeableText>
          ) : null}
          {item.send ? (
            <NumberSizeableText
              size="$bodyMd"
              formatter="balance"
              color="$textSubdued"
              formatterOptions={{ tokenSymbol: item.send.token.symbol }}
            >
              {`-${item.send.amount}`}
            </NumberSizeableText>
          ) : null}
        </YStack>
      </ListItem>
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: {
        title: string;
      };
    }) => (
      <SectionList.SectionHeader
        title={section.title}
        justifyContent="space-between"
      />
    ),
    [],
  );

  const intl = useIntl();

  return (
    <SectionList
      estimatedItemSize="$14"
      sections={sections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListEmptyComponent={
        <Empty
          icon="ClockTimeHistoryOutline"
          title={intl.formatMessage({
            id: ETranslations.global_no_transactions_yet,
          })}
          description={intl.formatMessage({
            id: ETranslations.global_no_transactions_yet_desc,
          })}
        />
      }
    />
  );
};
