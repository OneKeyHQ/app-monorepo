import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  Popover,
  SearchBar,
  SizableText,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { searchFundingHistoryMarketOptions } from '../fundingHistoryDisplay';

import type {
  IFundingHistoryMarketOption,
  IFundingHistorySideFilter,
} from '../fundingHistoryDisplay';

interface IFundingHistoryFilterToolbarProps {
  isMobile?: boolean;
  sideFilter: IFundingHistorySideFilter;
  marketFilter: string | undefined;
  marketOptions: IFundingHistoryMarketOption[];
  onSideFilterChange: (side: IFundingHistorySideFilter) => void;
  onMarketFilterChange: (coin: string | undefined) => void;
}

function FundingHistoryFilterTrigger({
  isMobile,
  label,
  isOpen,
  testID,
  maxWidth = 160,
  onPress,
}: {
  isMobile?: boolean;
  label: string;
  isOpen: boolean;
  testID: string;
  maxWidth?: number;
  onPress?: () => void;
}) {
  const backgroundColor = (() => {
    if (!isMobile) {
      return undefined;
    }
    return isOpen ? '$bgStrongActive' : '$bgActive';
  })();
  const iconName = isOpen
    ? 'ChevronTopSmallOutline'
    : 'ChevronDownSmallOutline';

  return (
    <XStack
      testID={testID}
      alignItems="center"
      gap="$1"
      cursor="pointer"
      userSelect="none"
      hitSlop={8}
      maxWidth={maxWidth}
      px={isMobile ? '$2' : undefined}
      py={isMobile ? '$1' : undefined}
      borderRadius={isMobile ? '$4' : undefined}
      bg={backgroundColor}
      hoverStyle={isMobile ? { bg: '$bgStrongHover' } : undefined}
      pressStyle={isMobile ? { bg: '$bgStrongActive' } : undefined}
      onPress={onPress}
    >
      <SizableText size="$bodySmMedium" numberOfLines={1}>
        {label}
      </SizableText>
      <Icon
        name={iconName}
        size={isMobile ? '$3.5' : '$4'}
        color="$iconSubdued"
      />
    </XStack>
  );
}

function FundingHistoryFilterOption({
  isMobile,
  label,
  selected,
  testID,
  insideScrollView,
  onPress,
}: {
  isMobile?: boolean;
  label: string;
  selected: boolean;
  testID: string;
  insideScrollView?: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      testID={testID}
      minHeight={isMobile ? 48 : 28}
      width={isMobile ? undefined : '100%'}
      alignSelf={isMobile ? 'stretch' : undefined}
      mx={isMobile && !insideScrollView ? '$-2' : undefined}
      px="$2"
      alignItems="center"
      justifyContent="space-between"
      borderRadius="$2"
      cursor="pointer"
      userSelect="none"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <SizableText
        size={isMobile ? '$bodyLg' : '$bodySm'}
        color="$text"
        numberOfLines={1}
      >
        {label}
      </SizableText>
      {selected ? (
        <Icon
          name="CheckLargeOutline"
          size={isMobile ? '$5' : '$4'}
          color="$iconActive"
        />
      ) : null}
    </XStack>
  );
}

type IFundingHistorySideOption = {
  label: string;
  value: IFundingHistorySideFilter;
};

function createFundingHistoryMarketOptionsStore(
  initialOptions: IFundingHistoryMarketOption[],
) {
  let options = initialOptions;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => options,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setOptions: (nextOptions: IFundingHistoryMarketOption[]) => {
      if (options === nextOptions) return;
      options = nextOptions;
      listeners.forEach((listener) => listener());
    },
  };
}

type IFundingHistoryMarketOptionsStore = ReturnType<
  typeof createFundingHistoryMarketOptionsStore
>;

function FundingHistorySideFilterContent({
  isMobile,
  options,
  selectedValue,
  onSelect,
}: {
  isMobile?: boolean;
  options: IFundingHistorySideOption[];
  selectedValue: IFundingHistorySideFilter;
  onSelect: (value: IFundingHistorySideFilter) => void;
}) {
  return (
    <YStack p={isMobile ? '$0' : '$1'} gap={isMobile ? '$1' : '$0.5'}>
      {options.map((option) => (
        <FundingHistoryFilterOption
          key={option.value}
          isMobile={isMobile}
          testID={`perps-funding-history-side-${option.value}`}
          label={option.label}
          selected={option.value === selectedValue}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </YStack>
  );
}

function MobileFundingHistorySideDialogContent({
  options,
  selectedValue,
  onSelect,
}: {
  options: IFundingHistorySideOption[];
  selectedValue: IFundingHistorySideFilter;
  onSelect: (value: IFundingHistorySideFilter) => void;
}) {
  const dialog = useDialogInstance();
  const handleSelect = useCallback(
    (value: IFundingHistorySideFilter) => {
      onSelect(value);
      void dialog.close();
    },
    [dialog, onSelect],
  );

  return (
    <FundingHistorySideFilterContent
      isMobile
      options={options}
      selectedValue={selectedValue}
      onSelect={handleSelect}
    />
  );
}

function FundingHistoryMarketFilterContent({
  isMobile,
  marketFilter,
  marketOptions,
  onSelect,
}: {
  isMobile?: boolean;
  marketFilter: string | undefined;
  marketOptions: IFundingHistoryMarketOption[];
  onSelect: (coin: string | undefined) => void;
}) {
  const intl = useIntl();
  const [searchText, setSearchText] = useState('');
  const filteredMarketOptions = useMemo(
    () =>
      searchFundingHistoryMarketOptions({
        options: marketOptions,
        searchText,
      }),
    [marketOptions, searchText],
  );

  return (
    <YStack
      p={isMobile ? '$0' : '$1.5'}
      gap={isMobile ? '$2' : '$1'}
      minHeight={isMobile ? 480 : undefined}
      maxHeight={isMobile ? 480 : 320}
    >
      <SearchBar
        value={searchText}
        onChangeText={setSearchText}
        placeholder={intl.formatMessage({
          id: ETranslations.global_search,
        })}
        testID="perps-funding-history-market-search"
        size={isMobile ? 'medium' : 'small'}
      />
      <Dialog.ScrollView
        maxHeight={isMobile ? 420 : 260}
        flexShrink={1}
        mx={isMobile ? '$-2' : undefined}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <YStack gap={isMobile ? '$1' : '$0.5'}>
          {!searchText.trim() ? (
            <FundingHistoryFilterOption
              isMobile={isMobile}
              insideScrollView
              testID="perps-funding-history-market-all"
              label={intl.formatMessage({
                id: ETranslations.global_all,
              })}
              selected={marketFilter === undefined}
              onPress={() => onSelect(undefined)}
            />
          ) : null}
          {filteredMarketOptions.map((option) => (
            <FundingHistoryFilterOption
              key={option.coin}
              isMobile={isMobile}
              insideScrollView
              testID={`perps-funding-history-market-${option.coin}`}
              label={option.label}
              selected={option.coin === marketFilter}
              onPress={() => onSelect(option.coin)}
            />
          ))}
          {filteredMarketOptions.length === 0 && searchText ? (
            <SizableText
              px={isMobile ? '$3' : '$2'}
              py="$3"
              size={isMobile ? '$bodyMd' : '$bodySm'}
              color="$textSubdued"
            >
              {intl.formatMessage({
                id: ETranslations.global_search_no_results_title,
              })}
            </SizableText>
          ) : null}
        </YStack>
      </Dialog.ScrollView>
    </YStack>
  );
}

function MobileFundingHistoryMarketDialogContent({
  marketFilter,
  marketOptionsStore,
  onSelect,
}: {
  marketFilter: string | undefined;
  marketOptionsStore: IFundingHistoryMarketOptionsStore;
  onSelect: (coin: string | undefined) => void;
}) {
  const dialog = useDialogInstance();
  const marketOptions = useSyncExternalStore(
    marketOptionsStore.subscribe,
    marketOptionsStore.getSnapshot,
    marketOptionsStore.getSnapshot,
  );
  const handleSelect = useCallback(
    (coin: string | undefined) => {
      onSelect(coin);
      void dialog.close();
    },
    [dialog, onSelect],
  );

  return (
    <FundingHistoryMarketFilterContent
      isMobile
      marketFilter={marketFilter}
      marketOptions={marketOptions}
      onSelect={handleSelect}
    />
  );
}

function FundingHistoryFilterToolbar({
  isMobile,
  sideFilter,
  marketFilter,
  marketOptions,
  onSideFilterChange,
  onMarketFilterChange,
}: IFundingHistoryFilterToolbarProps) {
  const intl = useIntl();
  const [sideOpen, setSideOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketOptionsStore] = useState(() =>
    createFundingHistoryMarketOptionsStore(marketOptions),
  );
  useEffect(() => {
    marketOptionsStore.setOptions(marketOptions);
  }, [marketOptions, marketOptionsStore]);
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
  const marketLabel = intl.formatMessage({
    id: ETranslations.global_market,
  });
  const handleSideDialogClose = useCallback(() => setSideOpen(false), []);
  const handleMarketDialogClose = useCallback(() => setMarketOpen(false), []);
  const handleShowSideDialog = useCallback(() => {
    setSideOpen(true);
    Dialog.show({
      title: sideLabel,
      showFooter: false,
      disableDrag: true,
      onClose: handleSideDialogClose,
      renderContent: (
        <MobileFundingHistorySideDialogContent
          options={sideOptions}
          selectedValue={sideFilter}
          onSelect={onSideFilterChange}
        />
      ),
    });
  }, [
    handleSideDialogClose,
    onSideFilterChange,
    sideFilter,
    sideLabel,
    sideOptions,
  ]);
  const handleShowMarketDialog = useCallback(() => {
    setMarketOpen(true);
    Dialog.show({
      title: marketLabel,
      showFooter: false,
      disableDrag: true,
      onClose: handleMarketDialogClose,
      renderContent: (
        <MobileFundingHistoryMarketDialogContent
          marketFilter={marketFilter}
          marketOptionsStore={marketOptionsStore}
          onSelect={onMarketFilterChange}
        />
      ),
    });
  }, [
    handleMarketDialogClose,
    marketFilter,
    marketLabel,
    marketOptionsStore,
    onMarketFilterChange,
  ]);

  return (
    <XStack
      mr={isMobile ? undefined : '$3'}
      gap={isMobile ? '$3' : '$4'}
      alignItems="center"
      flexShrink={isMobile ? undefined : 0}
    >
      {isMobile ? (
        <FundingHistoryFilterTrigger
          isMobile
          label={selectedSideLabel ?? sideLabel}
          isOpen={sideOpen}
          testID="perps-funding-history-side-filter"
          maxWidth={140}
          onPress={handleShowSideDialog}
        />
      ) : (
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
            <FundingHistorySideFilterContent
              options={sideOptions}
              selectedValue={sideFilter}
              onSelect={(value) => {
                onSideFilterChange(value);
                void closePopover();
              }}
            />
          )}
        />
      )}
      {isMobile ? (
        <FundingHistoryFilterTrigger
          isMobile
          label={selectedMarketLabel ?? marketLabel}
          isOpen={marketOpen}
          testID="perps-funding-history-market-filter"
          maxWidth={140}
          onPress={handleShowMarketDialog}
        />
      ) : (
        <Popover
          title={marketLabel}
          showHeader={false}
          open={marketOpen}
          onOpenChange={setMarketOpen}
          placement="bottom-end"
          floatingPanelProps={{
            width: 288,
            maxWidth: 288,
            maxHeight: 320,
            overflow: 'hidden',
          }}
          renderTrigger={
            <FundingHistoryFilterTrigger
              label={selectedMarketLabel ?? marketLabel}
              isOpen={marketOpen}
              testID="perps-funding-history-market-filter"
            />
          }
          renderContent={({ closePopover }) => (
            <FundingHistoryMarketFilterContent
              marketFilter={marketFilter}
              marketOptions={marketOptions}
              onSelect={(coin) => {
                onMarketFilterChange(coin);
                void closePopover();
              }}
            />
          )}
        />
      )}
    </XStack>
  );
}

export { FundingHistoryFilterToolbar };
