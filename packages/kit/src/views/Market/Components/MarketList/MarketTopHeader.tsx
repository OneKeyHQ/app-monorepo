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
import type { MarketTopTabName } from '@onekeyhq/kit/src/store/reducers/market';
import { setMarketSwapTabIndex } from '@onekeyhq/kit/src/views/Market/hooks/useMarketList';

import { ModalRoutes, RootRoutes, TabRoutes } from '../../../../routes/types';
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
        <Pressable flexDirection="row" flex={1} onPress={onPressSearch}>
          <Icon name="MagnifyingGlassMini" size={24} />
          <Typography.Body1Strong ml={1} color="text-subdued">
            {intl.formatMessage({ id: 'form__search_tokens' })}
          </Typography.Body1Strong>
        </Pressable>
      </Box>
    </Box>
  );
};

// type NavigationProps = NativeStackNavigationProp<
//   TabRoutesParams,
//   TabRoutes.Market
// >;

function HeaderSmall({
  marketTopTabName,
  onPressSearch,
}: {
  marketTopTabName: MarketTopTabName;
  onPressSearch: () => void;
}) {
  // const marketTopTabName = useMarketTopTabName();
  const intl = useIntl();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const navigation = useNavigation<NavigationProps>();
  return (
    <Box
      px="4"
      py="4"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      zIndex={1}
    >
      <Box flexDirection="row" h="9" alignContent="center">
        <Pressable
          mr="3"
          onPress={() => {
            setMarketSwapTabIndex(0);
          }}
        >
          <Typography.DisplayMedium
            color={
              marketTopTabName === TabRoutes.Swap
                ? 'text-default'
                : 'text-disabled'
            }
          >
            {intl.formatMessage({ id: 'title__Swap_Bridge' })}
          </Typography.DisplayMedium>
        </Pressable>
        <Pressable
          onPress={() => {
            setMarketSwapTabIndex(1);
          }}
        >
          <Typography.DisplayMedium
            color={
              marketTopTabName === TabRoutes.Market
                ? 'text-default'
                : 'text-disabled'
            }
          >
            {intl.formatMessage({ id: 'title__market' })}
          </Typography.DisplayMedium>
        </Pressable>
      </Box>
      <Box>
        {marketTopTabName === TabRoutes.Market ? (
          <IconButton
            size="base"
            name="MagnifyingGlassMini"
            type="plain"
            // iconSize={16}
            onPress={onPressSearch}
          />
        ) : null}
      </Box>
    </Box>
  );
}

const MarketHeader: FC<{
  marketTopTabName: MarketTopTabName;
}> = ({ marketTopTabName }) => {
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
  if (isVerticalLayout) {
    return (
      <HeaderSmall
        onPressSearch={onPressSearch}
        marketTopTabName={marketTopTabName}
      />
    );
  }
  if (marketTopTabName === TabRoutes.Swap) {
    return null;
  }
  return <Header onPressSearch={onPressSearch} />;
};

export default memo(MarketHeader);
