import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  ScrollView,
  SearchBar,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { searchFundingHistoryMarketOptions } from '../fundingHistoryDisplay';

import type {
  IFundingHistoryMarketOption,
  IFundingHistorySideFilter,
} from '../fundingHistoryDisplay';

interface IFundingHistoryFilterToolbarProps {
  sideFilter: IFundingHistorySideFilter;
  marketFilter: string | undefined;
  marketOptions: IFundingHistoryMarketOption[];
  onSideFilterChange: (side: IFundingHistorySideFilter) => void;
  onMarketFilterChange: (coin: string | undefined) => void;
}

function FundingHistoryFilterTrigger({
  label,
  isOpen,
  testID,
}: {
  label: string;
  isOpen: boolean;
  testID: string;
}) {
  return (
    <XStack
      testID={testID}
      alignItems="center"
      gap="$1"
      cursor="pointer"
      userSelect="none"
      hitSlop={8}
      maxWidth={160}
    >
      <SizableText size="$bodyMdMedium" numberOfLines={1}>
        {label}
      </SizableText>
      <Icon
        name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
        size="$4"
        color="$iconSubdued"
      />
    </XStack>
  );
}

function FundingHistoryFilterOption({
  label,
  selected,
  testID,
  onPress,
}: {
  label: string;
  selected: boolean;
  testID: string;
  onPress: () => void;
}) {
  return (
    <XStack
      testID={testID}
      minHeight={28}
      width="100%"
      px="$2"
      alignItems="center"
      borderRadius="$2"
      cursor="pointer"
      userSelect="none"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <SizableText
        size="$bodySm"
        color={selected ? '$text' : '$textSubdued'}
        numberOfLines={1}
      >
        {label}
      </SizableText>
    </XStack>
  );
}

function FundingHistoryFilterToolbar({
  sideFilter,
  marketFilter,
  marketOptions,
  onSideFilterChange,
  onMarketFilterChange,
}: IFundingHistoryFilterToolbarProps) {
  const intl = useIntl();
  const [sideOpen, setSideOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketSearchText, setMarketSearchText] = useState('');
  const sideOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.global_all }),
        value: 'all' as const,
      },
      {
        label: intl.formatMessage({ id: ETranslations.perp_long }),
        value: 'long' as const,
      },
      {
        label: intl.formatMessage({ id: ETranslations.perp_short }),
        value: 'short' as const,
      },
    ],
    [intl],
  );
  const filteredMarketOptions = useMemo(
    () =>
      searchFundingHistoryMarketOptions({
        options: marketOptions,
        searchText: marketSearchText,
      }),
    [marketOptions, marketSearchText],
  );
  const sideLabel = intl.formatMessage({
    id: ETranslations.perp_funding_side__label,
  });
  const selectedSideLabel =
    sideFilter === 'all'
      ? sideLabel
      : sideOptions.find((option) => option.value === sideFilter)?.label;
  const selectedMarketLabel = marketFilter
    ? marketOptions.find((option) => option.coin === marketFilter)?.label
    : undefined;

  return (
    <XStack mr="$3" gap="$4" alignItems="center">
      <Popover
        title={sideLabel}
        showHeader={false}
        open={sideOpen}
        onOpenChange={setSideOpen}
        placement="bottom-end"
        floatingPanelProps={{ width: 112, maxWidth: 112 }}
        renderTrigger={
          <FundingHistoryFilterTrigger
            label={selectedSideLabel ?? sideLabel}
            isOpen={sideOpen}
            testID="perps-funding-history-side-filter"
          />
        }
        renderContent={({ closePopover }) => (
          <YStack p="$1" gap="$0.5">
            {sideOptions.map((option) => {
              const selected = option.value === sideFilter;
              return (
                <FundingHistoryFilterOption
                  key={option.value}
                  testID={`perps-funding-history-side-${option.value}`}
                  label={option.label}
                  selected={selected}
                  onPress={() => {
                    onSideFilterChange(option.value);
                    void closePopover();
                  }}
                />
              );
            })}
          </YStack>
        )}
      />
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_market })}
        showHeader={false}
        open={marketOpen}
        onOpenChange={(open) => {
          setMarketOpen(open);
          if (!open) {
            setMarketSearchText('');
          }
        }}
        placement="bottom-end"
        floatingPanelProps={{
          width: 288,
          maxWidth: 288,
          maxHeight: 320,
          overflow: 'hidden',
        }}
        renderTrigger={
          <FundingHistoryFilterTrigger
            label={
              selectedMarketLabel ??
              intl.formatMessage({ id: ETranslations.global_market })
            }
            isOpen={marketOpen}
            testID="perps-funding-history-market-filter"
          />
        }
        renderContent={({ closePopover }) => (
          <YStack p="$1.5" gap="$1" maxHeight={320}>
            <SearchBar
              value={marketSearchText}
              onChangeText={setMarketSearchText}
              placeholder={intl.formatMessage({
                id: ETranslations.global_search,
              })}
              testID="perps-funding-history-market-search"
              size="small"
            />
            <ScrollView
              maxHeight={260}
              flexShrink={1}
              showsVerticalScrollIndicator={false}
            >
              <YStack gap="$0.5">
                {!marketSearchText.trim() ? (
                  <FundingHistoryFilterOption
                    testID="perps-funding-history-market-all"
                    label={intl.formatMessage({
                      id: ETranslations.global_all,
                    })}
                    selected={marketFilter === undefined}
                    onPress={() => {
                      onMarketFilterChange(undefined);
                      void closePopover();
                    }}
                  />
                ) : null}
                {filteredMarketOptions.map((option) => {
                  const selected = option.coin === marketFilter;
                  return (
                    <FundingHistoryFilterOption
                      key={option.coin}
                      testID={`perps-funding-history-market-${option.coin}`}
                      label={option.label}
                      selected={selected}
                      onPress={() => {
                        onMarketFilterChange(option.coin);
                        void closePopover();
                      }}
                    />
                  );
                })}
                {filteredMarketOptions.length === 0 && marketSearchText ? (
                  <SizableText
                    px="$2"
                    py="$3"
                    size="$bodySm"
                    color="$textSubdued"
                  >
                    {intl.formatMessage({
                      id: ETranslations.global_search_no_results_title,
                    })}
                  </SizableText>
                ) : null}
              </YStack>
            </ScrollView>
          </YStack>
        )}
      />
    </XStack>
  );
}

export { FundingHistoryFilterToolbar };
