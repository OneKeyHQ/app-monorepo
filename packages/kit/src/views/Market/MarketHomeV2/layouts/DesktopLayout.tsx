import { useIntl } from 'react-intl';

import { Button, SizableText, Stack, Tabs } from '@onekeyhq/components';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketFilterBar } from '../components/MarketFilterBar';
import { MarketTokenList } from '../components/MarketTokenList';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { ILiquidityFilter } from '../types';

export interface IToggleButtonProps {
  isActive: boolean;
  onPress: (() => void) | undefined;
  disabled: boolean;
  translationId: ETranslations;
  defaultMessage: string;
}

export function ToggleButton({
  isActive,
  onPress,
  disabled,
  translationId,
  defaultMessage,
}: IToggleButtonProps) {
  const intl = useIntl();

  return (
    <Button
      variant="tertiary"
      onPress={onPress}
      bg={isActive ? '$bgHover' : '$transparent'}
      disabled={disabled}
    >
      <SizableText
        size="$bodyLgMedium"
        color={isActive ? '$text' : '$textSubdued'}
      >
        {intl.formatMessage({
          id: translationId,
          defaultMessage,
        })}
      </SizableText>
    </Button>
  );
}

interface IDesktopLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    liquidityFilter: ILiquidityFilter;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
    onLiquidityFilterChange: (filter: ILiquidityFilter) => void;
  };
  selectedNetworkId: string;
  liquidityFilter: ILiquidityFilter;
}

export function DesktopLayout({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
}: IDesktopLayoutProps) {
  const [watchlistState] = useMarketWatchListV2Atom();
  const watchlist = watchlistState.data || [];

  return (
    <Stack flex={1} height="100%">
      <Tabs.Container
        initialTabName="trending"
        headerContainerStyle={{
          borderBottomWidth: 0,
          width: '100%',
          shadowColor: 'transparent',
        }}
        renderTabBar={(props) => (
          <Tabs.TabBar
            {...props}
            renderItem={({ name, isFocused, onPress }) => {
              const tabConfig = {
                watchlist: {
                  translationId: ETranslations.global_watchlist,
                  defaultMessage: 'Watchlist',
                },
                trending: {
                  translationId: ETranslations.market_trending,
                  defaultMessage: 'Trending',
                },
              }[name as 'watchlist' | 'trending'];

              if (!tabConfig) return null;

              return (
                <Stack px="$4" py="$3">
                  <ToggleButton
                    isActive={isFocused}
                    onPress={() => onPress(name)}
                    disabled={false}
                    translationId={tabConfig.translationId}
                    defaultMessage={tabConfig.defaultMessage}
                  />
                </Stack>
              );
            }}
          />
        )}
      >
        <Tabs.Tab name="watchlist">
          <Tabs.ScrollView>
            <Stack px="$4" flex={1}>
              <MarketTokenList
                networkId={selectedNetworkId}
                liquidityFilter={liquidityFilter}
                showWatchlistOnly
                watchlist={watchlist}
              />
            </Stack>
          </Tabs.ScrollView>
        </Tabs.Tab>

        <Tabs.Tab name="trending">
          <Stack px="$4">
            <MarketFilterBar {...filterBarProps} />
            <MarketTokenList
              networkId={selectedNetworkId}
              liquidityFilter={liquidityFilter}
              showWatchlistOnly={false}
              watchlist={watchlist}
            />
          </Stack>
        </Tabs.Tab>
      </Tabs.Container>
    </Stack>
  );
}
