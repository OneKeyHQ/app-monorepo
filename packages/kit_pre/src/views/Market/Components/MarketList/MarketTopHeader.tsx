import type { FC } from 'react';
import { memo, useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  IconButton,
  Pressable,
  Text,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { setMarketSwapTabName } from '@onekeyhq/kit/src/views/Market/hooks/useMarketList';

import {
  ModalRoutes,
  RootRoutes,
  TabRoutes,
} from '../../../../routes/routesEnum';
import { MarketRoutes } from '../../types';

import type { ModalScreenProps } from '../../../../routes/types';
import type { MarketRoutesParams } from '../../types';

type ModalNavigationProps = ModalScreenProps<MarketRoutesParams>;

const Header: FC<{ onPressSearch: () => void }> = ({ onPressSearch }) => {
  const intl = useIntl();

  return (
    <HStack
      height={{ base: '56px', md: '64px' }}
      alignItems="center"
      pl={{ base: '16px', md: '32px' }}
      pr={{ base: '10px', md: '32px' }}
    >
      <Text typography={{ sm: 'PageHeading', md: 'Heading' }}>
        {intl.formatMessage({ id: 'market__market' })}
      </Text>
      <Box ml="16px" mr="8px" h="16px" w="1px" bgColor="divider" />
      <Pressable
        onPress={onPressSearch}
        flexDirection="row"
        p="8px"
        borderRadius="xl"
        _hover={{ bg: 'surface-hovered' }}
        _pressed={{ bg: 'surface-pressed' }}
      >
        <Icon name="MagnifyingGlassMini" size={20} color="icon-subdued" />
        <Text typography="Body2" color="text-subdued" ml={2}>
          {intl.formatMessage({ id: 'form__search_tokens' })}
        </Text>
      </Pressable>
    </HStack>
  );
};

// type NavigationProps = NativeStackNavigationProp<
//   TabRoutesParams,
//   TabRoutes.Market
// >;

function HeaderSmall({ onPressSearch }: { onPressSearch: () => void }) {
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
          onPress={() => {
            setMarketSwapTabName(TabRoutes.Market);
          }}
        >
          <Typography.DisplayMedium color="text-default">
            {intl.formatMessage({ id: 'market__market' })}
          </Typography.DisplayMedium>
        </Pressable>
      </Box>
      <Box>
        <IconButton
          size="base"
          name="MagnifyingGlassMini"
          type="plain"
          // iconSize={16}
          onPress={onPressSearch}
        />
      </Box>
    </Box>
  );
}

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
  if (isVerticalLayout) {
    return <HeaderSmall onPressSearch={onPressSearch} />;
  }
  return <Header onPressSearch={onPressSearch} />;
};

export default memo(MarketHeader);
