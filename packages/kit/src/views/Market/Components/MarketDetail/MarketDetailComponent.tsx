import type { FC } from 'react';
import { useCallback } from 'react';

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
  MarketNews,
} from '@onekeyhq/kit/src/store/reducers/market';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

import { buildAddressDetailsUrl } from '../../../../hooks/useOpenBlockBrowser';
import { useCurrencyUnit } from '../../../Me/GenaralSection/CurrencySelect/hooks';
import { useGridBoxStyle } from '../../hooks/useMarketLayout';
import {
  formatMarketUnitPosition,
  formatMarketValueForInfo,
} from '../../utils';

import { MarketInfoExplorer } from './MarketInfoExplorer';
import { MarketInfoLinks } from './MarketInfoLinks';
import { MarketInfoNewsList } from './MarketInfoNewsList';

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
  const { network } = useNetwork({ networkId: explorer.networkId });
  const copyAction = useCallback(() => {
    copyToClipboard(explorer.contractAddress ?? '');
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__copied' }),
    });
  }, [explorer.contractAddress, intl]);
  const ExplorerComponent = useCallback(
    (i, e, triggerProps) => (
      <MarketInfoExplorer
        key={i}
        index={i}
        explorer={e}
        triggerProps={triggerProps}
      />
    ),
    [],
  );
  return (
    <Menu
      trigger={(triggerProps) =>
        ExplorerComponent(index, explorer, triggerProps)
      }
    >
      <Menu.CustomItem onPress={copyAction} icon="DocumentDuplicateMini">
        {intl.formatMessage({ id: 'action__copy_address' })}
      </Menu.CustomItem>
      {explorer?.networkId ? (
        <Menu.CustomItem
          onPress={() => {
            openUrl(
              buildAddressDetailsUrl(network, explorer.contractAddress ?? ''),
              intl.formatMessage({ id: 'form__explorers' }),
              {
                modalMode: true,
              },
            );
          }}
          icon="ArrowTopRightOnSquareMini"
        >
          {intl.formatMessage(
            { id: 'action__view_in_str' },
            { 0: explorer.name },
          )}
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
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        mb="3"
      >
        <Typography.Body2Strong color="text-subdued">
          {title}
        </Typography.Body2Strong>
        <Box alignItems="flex-end">
          {isFetching ? (
            <Skeleton shape="Body2" />
          ) : (
            <Typography.Body2Strong color={valueColor ?? 'text-default'}>
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
  marketCapDominance?: string;
  marketCapRank?: number;
  volume24h?: number;
  marketCap?: number;
  expolorers?: MarketEXplorer[];
  news?: MarketNews[];
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
  marketCapDominance,
  marketCapRank,
  marketCap,
  expolorers,
  news,
  about,
  links,
  px,
  atl,
  ath,
}) => {
  const intl = useIntl();
  const { selectedFiatMoneySymbol } = useSettings();
  const unit = useCurrencyUnit(selectedFiatMoneySymbol);

  return (
    <Box px={px}>
      <VStack space={6} mt={2}>
        <Box>
          <Typography.Heading mb={2}>
            {intl.formatMessage({ id: 'content__stats' })}
          </Typography.Heading>
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
              isFetching={marketCapDominance === undefined}
              title={intl.formatMessage({ id: 'form__market_cap_dominance' })}
              value={`${marketCapDominance || 0}`}
            />
            <DataViewComponent
              index={3}
              isFetching={volume24h === undefined}
              title={intl.formatMessage({ id: 'form__24h_volume' })}
              value={formatMarketUnitPosition(
                unit,
                formatMarketValueForInfo(volume24h),
              )}
            />
            <DataViewComponent
              index={4}
              isFetching={low24h === undefined}
              title={intl.formatMessage({ id: 'form__24h_low' })}
              value={formatMarketUnitPosition(
                unit,
                formatMarketValueForInfo(low24h),
              )}
            />
            <DataViewComponent
              index={5}
              isFetching={high24h === undefined}
              title={intl.formatMessage({ id: 'form__24h_high' })}
              value={formatMarketUnitPosition(
                unit,
                formatMarketValueForInfo(high24h),
              )}
            />
            <DataViewComponent
              index={6}
              isFetching={atl?.value === undefined}
              title={intl.formatMessage({ id: 'form__all_time_low' })}
              value={formatMarketUnitPosition(
                unit,
                formatMarketValueForInfo(atl?.value),
              )}
            />
            <DataViewComponent
              index={7}
              isFetching={ath?.value === undefined}
              title={intl.formatMessage({ id: 'form__all_time_high' })}
              value={formatMarketUnitPosition(
                unit,
                formatMarketValueForInfo(ath?.value),
              )}
            />
          </Box>
        </Box>
        {expolorers?.length ? (
          <Box>
            <Typography.Heading mb={2}>
              {intl.formatMessage({ id: 'form__explorers' })}
            </Typography.Heading>
            <Box flexDirection="row" alignContent="flex-start" flexWrap="wrap">
              {expolorers?.map((e: MarketEXplorer, i) => (
                <ExplorerAction explorer={e} index={i} />
              ))}
            </Box>
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
        {news?.length ? (
          <Box>
            <Typography.Heading>
              {intl.formatMessage({ id: 'title__news' })}
            </Typography.Heading>
            <MarketInfoNewsList news={news} />
          </Box>
        ) : null}
      </VStack>
    </Box>
  );
};
