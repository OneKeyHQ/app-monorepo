import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { format as dateFormat, isValid as dateIsValid } from 'date-fns';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Menu,
  Skeleton,
  ToastManager,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { useNetwork, useSettings } from '@onekeyhq/kit/src/hooks';
import type {
  MarketEXplorer,
  MarketLinks,
} from '@onekeyhq/kit/src/store/reducers/market';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

import useOpenBlockBrowser from '../../../../hooks/useOpenBlockBrowser';
import { useCurrencyUnit } from '../../../Me/GenaralSection/CurrencySelect/hooks';
import { defaultMenuOffset } from '../../../Overlay/BaseMenu';
import { GridLayout, useGridBoxStyle } from '../../hooks/useMarketLayout';
import {
  formatMarketUnitPosition,
  formatMarketValueForInfo,
} from '../../utils';

import { MarketInfoExplorer } from './MarketInfoExplorer';
import { MarketInfoLinks } from './MarketInfoLinks';

type DataViewComponentProps = {
  title?: string;
  value?: string;
  subValue?: string;
  valueColor?: string;
  index?: number;
  isFetching?: boolean;
};

const ExplorerAction = ({
  explorer,
  index,
}: {
  index: number;
  explorer: MarketEXplorer;
}) => {
  const intl = useIntl();
  const { width } = useGridBoxStyle({
    index,
    maxW: SCREEN_SIZE.LARGE,
    outPadding: 32,
  });
  const copyAction = useCallback(() => {
    setTimeout(() => {
      if (!explorer.contractAddress) return;
      copyToClipboard(explorer.contractAddress);
    }, 200);
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__copied' }),
    });
  }, [explorer.contractAddress, intl]);
  const { network } = useNetwork({ networkId: explorer.networkId });
  const { openAddressDetails } = useOpenBlockBrowser(network);
  const renderExplorerComponent = useCallback(
    (triggerProps) => (
      <MarketInfoExplorer
        key={index}
        index={index}
        explorer={explorer}
        triggerProps={triggerProps}
      />
    ),
    [explorer, index],
  );
  return (
    <Menu
      offset={defaultMenuOffset}
      width={width}
      minWidth={220}
      trigger={renderExplorerComponent}
    >
      <Menu.CustomItem onPress={copyAction} icon="DocumentDuplicateMini">
        {intl.formatMessage({ id: 'action__copy_address' })}
      </Menu.CustomItem>
      {explorer?.networkId &&
      !network?.settings?.hiddenBlockBrowserTokenDetailLink ? (
        <Menu.CustomItem
          onPress={() => {
            openAddressDetails(
              explorer.contractAddress ?? '',
              intl.formatMessage({ id: 'form__explorers' }),
            );
          }}
          icon="ArrowTopRightOnSquareMini"
        >
          {intl.formatMessage({ id: 'action__view_in_browser' })}
        </Menu.CustomItem>
      ) : null}
    </Menu>
  );
};

const DataViewComponent: FC<DataViewComponentProps> = ({
  title,
  value,
  subValue,
  valueColor,
  index,
  isFetching,
}) => {
  const gridBoxStyle = useGridBoxStyle({
    index,
    outPadding: 32,
    maxW: SCREEN_SIZE.LARGE,
  });
  return (
    <Box {...gridBoxStyle}>
      <Box
        alignItems="flex-start"
        justifyContent="space-between"
        mb={2}
        flex={1}
      >
        <Typography.Body2Strong color="text-subdued">
          {title}
        </Typography.Body2Strong>
        <Box flex={1} alignItems="flex-start">
          {isFetching ? (
            <Skeleton shape="Body2" />
          ) : (
            <Typography.Body2Strong
              textAlign="right"
              numberOfLines={2}
              color={valueColor ?? 'text-default'}
            >
              {value}
            </Typography.Body2Strong>
          )}
          {subValue ? (
            <Typography.Caption color="text-subdued">
              {subValue}
            </Typography.Caption>
          ) : null}
        </Box>
      </Box>
      <Divider />
    </Box>
  );
};

type MarketDetailComponentProps = {
  low24h?: number;
  high24h?: number;
  // marketCapDominance?: string;
  marketCapRank?: number;
  volume24h?: number;
  marketCap?: number;
  expolorers?: MarketEXplorer[];
  // news?: MarketNews[];   marketCapDominance and news The source was intercepted by an anti-crawler and temporarily blocked
  about?: string;
  atl?: {
    time?: string;
    value?: number;
  };
  ath?: {
    time?: string;
    value?: number;
  };
  links?: MarketLinks;
  px?: string;
};

export const MarketDetailComponent: FC<MarketDetailComponentProps> = ({
  low24h,
  high24h,
  volume24h,
  marketCapRank,
  marketCap,
  expolorers,
  about,
  links,
  px,
  atl,
  ath,
}) => {
  const intl = useIntl();
  const { selectedFiatMoneySymbol } = useSettings();
  const unit = useCurrencyUnit(selectedFiatMoneySymbol);
  const { athTime, atlTime } = useMemo(() => {
    const athDate = new Date(ath?.time ?? '');
    const atlDate = new Date(atl?.time ?? '');
    return {
      athTime: dateIsValid(athDate)
        ? dateFormat(athDate, 'yyyy-MM-dd')
        : undefined,
      atlTime: dateIsValid(atlDate)
        ? dateFormat(atlDate, 'yyyy-MM-dd')
        : undefined,
    };
  }, [ath, atl]);
  return (
    <Box px={px}>
      <VStack space={6} my={2}>
        <Box>
          <Typography.Heading mb={2}>
            {intl.formatMessage({ id: 'content__stats' })}
          </Typography.Heading>
          <GridLayout>
            <Box flexDirection="row" alignContent="flex-start" flexWrap="wrap">
              <DataViewComponent
                index={0}
                isFetching={marketCap === undefined}
                title={intl.formatMessage({ id: 'form__market_cap' })}
                value={formatMarketUnitPosition(
                  unit,
                  formatMarketValueForInfo(marketCap),
                )}
              />
              <DataViewComponent
                index={1}
                isFetching={marketCapRank === undefined}
                title={intl.formatMessage({ id: 'form__market_cap_rank' })}
                value={`#${marketCapRank ?? 0}`}
              />
              <DataViewComponent
                index={2}
                isFetching={volume24h === undefined}
                title={intl.formatMessage({ id: 'form__24h_volume' })}
                value={formatMarketUnitPosition(
                  unit,
                  formatMarketValueForInfo(volume24h),
                )}
              />
              <DataViewComponent
                index={3}
                isFetching={low24h === undefined}
                title={intl.formatMessage({ id: 'form__24h_low' })}
                value={formatMarketUnitPosition(
                  unit,
                  formatMarketValueForInfo(low24h),
                )}
              />
              <DataViewComponent
                index={4}
                isFetching={high24h === undefined}
                title={intl.formatMessage({ id: 'form__24h_high' })}
                value={formatMarketUnitPosition(
                  unit,
                  formatMarketValueForInfo(high24h),
                )}
              />
              <DataViewComponent
                index={5}
                isFetching={atl?.value === undefined}
                title={intl.formatMessage({ id: 'form__all_time_low' })}
                value={formatMarketUnitPosition(
                  unit,
                  formatMarketValueForInfo(atl?.value),
                )}
                subValue={atlTime}
              />
              <DataViewComponent
                index={6}
                isFetching={ath?.value === undefined}
                title={intl.formatMessage({ id: 'form__all_time_high' })}
                value={formatMarketUnitPosition(
                  unit,
                  formatMarketValueForInfo(ath?.value),
                )}
                subValue={athTime}
              />
            </Box>
          </GridLayout>
        </Box>
        {expolorers?.length ? (
          <Box>
            <Typography.Heading mb={2}>
              {intl.formatMessage({ id: 'form__explorers' })}
            </Typography.Heading>
            <GridLayout>
              <Box
                flexDirection="row"
                alignContent="flex-start"
                flexWrap="wrap"
              >
                {expolorers?.map((e: MarketEXplorer, i) => {
                  if (e.url) {
                    return (
                      <MarketInfoExplorer
                        key={i}
                        index={i}
                        explorer={e}
                        onPress={() => {
                          openUrl(
                            e.url ?? '',
                            intl.formatMessage({ id: 'form__explorers' }),
                            {
                              modalMode: true,
                            },
                          );
                        }}
                      />
                    );
                  }
                  return <ExplorerAction explorer={e} index={i} />;
                })}
              </Box>
            </GridLayout>
          </Box>
        ) : null}
        {about?.length ? (
          <Box>
            <Typography.Heading mb={2}>
              {intl.formatMessage({ id: 'title__about' })}
            </Typography.Heading>
            <Typography.Body2 noOfLines={5}>{about}</Typography.Body2>
          </Box>
        ) : null}
        {links ? <MarketInfoLinks links={links} /> : null}
        {/* {news?.length ? (
          <Box>
            <Typography.Heading>
              {intl.formatMessage({ id: 'title__news' })}
            </Typography.Heading>
            <MarketInfoNewsList news={news} />
          </Box>
        ) : null} */}
      </VStack>
    </Box>
  );
};
