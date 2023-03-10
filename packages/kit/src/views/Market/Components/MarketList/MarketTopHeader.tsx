import type { FC } from 'react';
import { memo, useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Icon,
  IconButton,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  MARKET_TAB_NAME,
  SWAP_TAB_NAME,
} from '@onekeyhq/kit/src/store/reducers/market';

import { ModalRoutes, RootRoutes } from '../../../../routes/types';
import { SwapHeaderButtons } from '../../../Swap/SwapHeader';
import { useMarketTopTabName } from '../../hooks/useMarketList';
import { MarketRoutes } from '../../types';

import type { ModalScreenProps } from '../../../../routes/types';
import type { MarketRoutesParams } from '../../types';

type ModalNavigationProps = ModalScreenProps<MarketRoutesParams>;

const Header: FC<{ onPressSearch: () => void }> = ({ onPressSearch }) => {
  const intl = useIntl();

  return (
    <Box flexDirection="column" w="full" mb={4}>
      <Box mt="4" ml="6" flexDirection="row" alignItems="center">
        <Typography.DisplayLarge>
          {intl.formatMessage({ id: 'title__market' })}
        </Typography.DisplayLarge>
        <Box
          h="20px"
          borderLeftWidth={StyleSheet.hairlineWidth}
          borderLeftColor="border-subdued"
          mx={3}
        />
        <Pressable flexDirection="row" onPress={onPressSearch}>
          <Icon name="MagnifyingGlassMini" size={24} />
          <Typography.Body1Strong ml={1} color="text-subdued">
            {intl.formatMessage({ id: 'form__search_tokens' })}
          </Typography.Body1Strong>
        </Pressable>
      </Box>
    </Box>
  );
};

const HeaderSmall: FC<{ onPressSearch: () => void }> = ({ onPressSearch }) => {
  const tabName = useMarketTopTabName();
  const intl = useIntl();
  const marketTopTabName = useMarketTopTabName();
  return (
    <Box
      px="4"
      py="4"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      zIndex={1}
    >
      <Box flexDirection="row">
        <Pressable
          mr="3"
          onPress={() => {
            backgroundApiProxy.serviceMarket.switchMarketTopTab(SWAP_TAB_NAME);
          }}
        >
          <Typography.DisplayMedium
            color={tabName === SWAP_TAB_NAME ? 'text-default' : 'text-disabled'}
          >
            {intl.formatMessage({ id: 'title__Swap_Bridge' })}
          </Typography.DisplayMedium>
        </Pressable>
        <Pressable
          onPress={() => {
            backgroundApiProxy.serviceMarket.switchMarketTopTab(
              MARKET_TAB_NAME,
            );
          }}
        >
          <Typography.DisplayMedium
            color={
              tabName === MARKET_TAB_NAME ? 'text-default' : 'text-disabled'
            }
          >
            {intl.formatMessage({ id: 'title__market' })}
          </Typography.DisplayMedium>
        </Pressable>
      </Box>
      <Box>
        {marketTopTabName === MARKET_TAB_NAME ? (
          <IconButton
            size="base"
            name="MagnifyingGlassMini"
            type="plain"
            // iconSize={16}
            onPress={onPressSearch}
          />
        ) : null}
        {marketTopTabName === SWAP_TAB_NAME ? <SwapHeaderButtons /> : null}
      </Box>
    </Box>
  );
};

const MarketHeader: FC = () => {
  const navigation = useNavigation<ModalNavigationProps['navigation']>();
  const isVerticalLayout = useIsVerticalLayout();
  const onPressSearch = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Market,
      params: {
        screen: MarketRoutes.MarketSearchModal,
      },
    });
  }, [navigation]);
  return isVerticalLayout ? (
    <HeaderSmall onPressSearch={onPressSearch} />
  ) : (
    <Header onPressSearch={onPressSearch} />
  );
};

export default memo(MarketHeader);
