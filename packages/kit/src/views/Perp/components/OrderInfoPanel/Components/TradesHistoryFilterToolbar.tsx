import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Popover,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  FundingHistoryFilterOption,
  FundingHistoryFilterToolbar,
  FundingHistoryFilterTrigger,
} from './FundingHistoryFilterToolbar';

import type { ITradeHistoryTypeFilter } from './tradeFillDisplay';
import type { useTradeHistoryFilters } from '../../../hooks/useTradeHistoryFilters';

type ITypeOption = { value: ITradeHistoryTypeFilter; label: string };
type ITypeContentProps = {
  isMobile?: boolean;
  options: ITypeOption[];
  value: ITradeHistoryTypeFilter;
  onSelect: (value: ITradeHistoryTypeFilter) => void;
};

function TypeOptions({
  isMobile,
  options,
  value,
  onSelect,
}: ITypeContentProps) {
  return (
    <YStack p={isMobile ? '$0' : '$1'} gap={isMobile ? '$1' : '$0.5'}>
      {options.map((option) => (
        <FundingHistoryFilterOption
          key={option.value}
          isMobile={isMobile}
          label={option.label}
          selected={value === option.value}
          testID={`perps-trade-history-type-${option.value}`}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </YStack>
  );
}

function MobileTypeOptions({ onSelect, ...props }: ITypeContentProps) {
  const dialog = useDialogInstance();
  return (
    <TypeOptions
      {...props}
      isMobile
      onSelect={(value) => {
        onSelect(value);
        void dialog.close();
      }}
    />
  );
}

export function TradesHistoryFilterToolbar({
  isMobile,
  filters,
  setFilters,
  marketOptions,
}: Pick<
  ReturnType<typeof useTradeHistoryFilters>,
  'filters' | 'setFilters' | 'marketOptions'
> & { isMobile?: boolean }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const title = intl.formatMessage({ id: ETranslations.perp_open_orders_type });
  const options: ITypeOption[] = [
    {
      value: 'all',
      label: intl.formatMessage({ id: ETranslations.global_all }),
    },
    {
      value: 'spot',
      label: intl.formatMessage({ id: ETranslations.dexmarket_spot }),
    },
    {
      value: 'perp',
      label: intl.formatMessage({ id: ETranslations.perp_label_perp }),
    },
  ];
  const label =
    filters.type === 'all'
      ? title
      : (options.find((option) => option.value === filters.type)?.label ??
        title);
  const onSelect = useCallback(
    (type: ITradeHistoryTypeFilter) => {
      setFilters((current) => ({ ...current, type, market: undefined }));
    },
    [setFilters],
  );
  const handleClose = useCallback(() => setOpen(false), []);
  return (
    <XStack
      gap={isMobile ? '$3' : '$4'}
      alignItems="center"
      flexWrap={isMobile ? 'wrap' : 'nowrap'}
      flexShrink={isMobile ? undefined : 0}
    >
      {isMobile ? (
        <FundingHistoryFilterTrigger
          isMobile
          label={label}
          isOpen={open}
          testID="perps-trade-history-type-filter"
          onPress={() => {
            setOpen(true);
            Dialog.show({
              title,
              showFooter: false,
              disableDrag: true,
              onClose: handleClose,
              renderContent: (
                <MobileTypeOptions
                  options={options}
                  value={filters.type}
                  onSelect={onSelect}
                />
              ),
            });
          }}
        />
      ) : (
        <Popover
          title={title}
          showHeader={false}
          open={open}
          onOpenChange={setOpen}
          placement="bottom-end"
          floatingPanelProps={{ width: 112, maxWidth: 112 }}
          renderTrigger={
            <FundingHistoryFilterTrigger
              label={label}
              isOpen={open}
              testID="perps-trade-history-type-filter"
            />
          }
          renderContent={({ closePopover }) => (
            <TypeOptions
              options={options}
              value={filters.type}
              onSelect={(value) => {
                onSelect(value);
                void closePopover();
              }}
            />
          )}
        />
      )}
      <FundingHistoryFilterToolbar
        isMobile={isMobile}
        sideFilter={filters.side}
        sideLabels={{
          long: `${intl.formatMessage({ id: ETranslations.perp_long })}/${intl.formatMessage({ id: ETranslations.global_buy })}`,
          short: `${intl.formatMessage({ id: ETranslations.perp_short })}/${intl.formatMessage({ id: ETranslations.global_sell })}`,
        }}
        marketFilter={filters.market}
        marketOptions={[
          {
            coin: 'active',
            label: intl.formatMessage({ id: ETranslations.global_current }),
          },
          ...marketOptions,
        ]}
        onSideFilterChange={(side) =>
          setFilters((current) => ({ ...current, side }))
        }
        onMarketFilterChange={(market) =>
          setFilters((current) => ({ ...current, market }))
        }
      />
    </XStack>
  );
}
