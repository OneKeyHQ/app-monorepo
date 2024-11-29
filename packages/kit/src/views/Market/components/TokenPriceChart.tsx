import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { TouchableWithoutFeedback } from 'react-native';

import {
  Icon,
  SegmentControl,
  Select,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketDetailTicker,
  IMarketTokenChart,
} from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TradingView } from '../../../components/TradingView';

import { PriceChart } from './Chart';

import type { ITradingViewProps } from '../../../components/TradingView';
import type { IDeferredPromise } from '../../../hooks/useDeferredPromise';

interface IChartProps {
  renderSelectElement?: ReactElement;
  coinGeckoId: string;
  symbol?: string;
  defer: IDeferredPromise<unknown>;
  tickers?: IMarketDetailTicker[];
}

function NativeTokenPriceChart({
  coinGeckoId,
  defer,
  renderSelectElement,
}: IChartProps) {
  const intl = useIntl();
  const [points, setPoints] = useState<IMarketTokenChart>([]);
  const [isLoading, setIsLoading] = useState(false);
  const options = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.market_1d }),
        value: '1',
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1w }),
        value: '7',
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1m }),
        value: '30',
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1y }),
        value: '365',
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_all }),
        value: 'max',
      },
    ],
    [intl],
  );
  const [days, setDays] = useState<string>(options[0].value);

  const init = useCallback(async () => {
    setIsLoading(true);
    const response = await backgroundApiProxy.serviceMarket.fetchTokenChart(
      coinGeckoId,
      days,
    );
    if (platformEnv.isNativeAndroid) {
      setTimeout(() => {
        defer.resolve(null);
      }, 100);
    } else {
      await defer.promise;
    }
    setPoints(response);
    setIsLoading(false);
  }, [coinGeckoId, days, defer]);

  useEffect(() => {
    void init();
  }, [init]);
  const { gtLg } = useMedia();
  return (
    <>
      <YStack px="$5" $gtMd={{ pr: platformEnv.isNative ? '$5' : 0 }}>
        <YStack h={platformEnv.isNative ? 240 : 326} $gtMd={{ h: 294 }}>
          <PriceChart isFetching={isLoading} data={points}>
            {gtLg && !isLoading ? (
              <SegmentControl
                value={days}
                onChange={setDays as ISegmentControlProps['onChange']}
                options={options}
              />
            ) : null}
          </PriceChart>
        </YStack>
      </YStack>
      {gtLg ? null : (
        <XStack
          mt={platformEnv.isNative ? -28 : '$5'}
          gap="$3"
          ai="center"
          px="$1"
          pr="$5"
        >
          {renderSelectElement}
          <SegmentControl
            fullWidth={!renderSelectElement}
            value={days}
            jc="space-between"
            flex={1}
            onChange={setDays as ISegmentControlProps['onChange']}
            options={options}
          />
        </XStack>
      )}
    </>
  );
}

function TradingViewChart({
  targetToken,
  identifier,
  baseToken,
  defer,
}: Omit<ITradingViewProps, 'mode'> & {
  defer: IDeferredPromise<unknown>;
}) {
  const { gtMd } = useMedia();
  useEffect(() => {
    if (platformEnv.isNativeAndroid) {
      setTimeout(() => {
        defer.resolve(null);
      }, 450);
    } else {
      defer.resolve(null);
    }
  }, [defer]);
  const handlePressIn = useCallback(() => {
    appEventBus.emit(
      EAppEventBusNames.ChangeTokenDetailTabVerticalScrollEnabled,
      { enabled: false },
    );
  }, []);

  const handlePressOut = useCallback(() => {
    setTimeout(() => {
      appEventBus.emit(
        EAppEventBusNames.ChangeTokenDetailTabVerticalScrollEnabled,
        { enabled: true },
      );
    }, 50);
  }, []);

  const content = (
    <TradingView
      mode="overview"
      $gtMd={{ h: 450, pl: '$5' }}
      $md={{ pt: '$6' }}
      targetToken={targetToken}
      baseToken={baseToken}
      identifier={identifier}
      h={450}
      onTouchStart={handlePressIn}
      onTouchEnd={handlePressOut}
    />
  );

  return gtMd ? (
    content
  ) : (
    <YStack>
      {content}
      <Stack h={1} width="100%" bg="$bgApp" position="absolute" top={24} />
      <Stack h={1} width="100%" bg="$bgApp" position="absolute" top={63} />
      <Stack h={1} width="100%" bg="$bgApp" position="absolute" bottom={0} />
    </YStack>
  );
}

const identifiers = [
  'binance',
  'bybit',
  'mexc',
  'bitgit',
  'coinbase',
  'bitfinex',
  'kraken',
  'okx',
  'gate',
];

enum EChartType {
  tradingView = 'Trading View',
  liteChart = 'Lite Chart',
}

const targets = ['USD', 'USDT', 'USDC'];
const resolveIdentifierName = (name: string) => {
  if (name === 'gate') {
    return 'GATEIO';
  }
  return name;
};
function BasicTokenPriceChart({ coinGeckoId, defer, tickers }: IChartProps) {
  const [chartViewType, setChartViewType] = useState(EChartType.tradingView);
  const intl = useIntl();
  const { gtLg } = useMedia();
  const ticker = useMemo(() => {
    if (!tickers?.length) {
      return null;
    }
    for (let i = 0; i < tickers.length; i += 1) {
      const t = tickers[i];
      if (targets.includes(t.target)) {
        if (identifiers.includes(t.market.identifier)) {
          return {
            identifier: resolveIdentifierName(t.market.identifier),
            baseToken: t.base,
            targetToken: t.target,
          };
        }

        if (identifiers.includes(t.market.name.toLowerCase())) {
          return {
            identifier: t.market.name.toLowerCase(),
            baseToken: t.base,
            targetToken: t.target,
          };
        }
      }
    }
  }, [tickers]);

  const selectOptions = useMemo(
    () => [
      {
        value: EChartType.tradingView,
        label: EChartType.tradingView,
      },
      {
        value: EChartType.liteChart,
        label: intl.formatMessage({ id: ETranslations.market_lite_chart }),
      },
    ],
    [intl],
  );

  const selectElement = useMemo(
    () =>
      ticker ? (
        <Select
          items={selectOptions}
          value={chartViewType}
          onChange={setChartViewType}
          title={intl.formatMessage({ id: ETranslations.market_chart })}
          renderTrigger={({ label }) => (
            <XStack
              gap="$1"
              ai="center"
              $md={{ mx: '$4' }}
              $gtMd={{ pb: '$4', ml: '$5' }}
            >
              <SizableText color="$textSubdued" size="$bodyMdMedium">
                {label}
              </SizableText>
              <Icon
                size="$5"
                name="ChevronDownSmallOutline"
                color="$iconSubdued"
              />
            </XStack>
          )}
        />
      ) : null,
    [chartViewType, intl, selectOptions, ticker],
  );

  const tradingViewChartElement = useMemo(
    () =>
      ticker ? (
        <TradingViewChart
          defer={defer}
          identifier={ticker?.identifier}
          baseToken={ticker?.baseToken}
          targetToken={ticker?.targetToken}
        />
      ) : null,
    [defer, ticker],
  );

  const content = useMemo(() => {
    if (!ticker) {
      return null;
    }
    if (gtLg) {
      return (
        <>
          {selectElement}
          {chartViewType === EChartType.tradingView ? (
            tradingViewChartElement
          ) : (
            <NativeTokenPriceChart coinGeckoId={coinGeckoId} defer={defer} />
          )}
        </>
      );
    }

    return (
      <>
        {chartViewType === EChartType.tradingView ? (
          <YStack>
            {tradingViewChartElement}
            <YStack pt="$3">{selectElement}</YStack>
          </YStack>
        ) : (
          <NativeTokenPriceChart
            coinGeckoId={coinGeckoId}
            defer={defer}
            renderSelectElement={selectElement}
          />
        )}
      </>
    );
  }, [
    chartViewType,
    coinGeckoId,
    defer,
    gtLg,
    selectElement,
    ticker,
    tradingViewChartElement,
  ]);

  if (!ticker) {
    return <NativeTokenPriceChart coinGeckoId={coinGeckoId} defer={defer} />;
  }

  return <YStack>{content}</YStack>;
}

export const TokenPriceChart = memo(BasicTokenPriceChart);
