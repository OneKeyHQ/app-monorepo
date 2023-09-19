import type { FC } from 'react';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIsFocused } from '@react-navigation/native';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import KeyboardManager from 'react-native-keyboard-manager';

import {
  Box,
  Button,
  Center,
  HStack,
  IconButton,
  Image,
  Input,
  Spinner,
  Text,
  useIsVerticalLayout,
  useTheme,
} from '@onekeyhq/components';
import PnlEmptyImage from '@onekeyhq/kit/assets/nft_pnl_empty_image.png';
import PnlEmptyImageLight from '@onekeyhq/kit/assets/nft_pnl_empty_image_light.png';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import { useActiveWalletAccount } from '../../../../hooks';
import { useConnectAndCreateExternalAccount } from '../../../ExternalAccount/useConnectAndCreateExternalAccount';
import { NFTMarketRoutes } from '../../Modals/type';

import { useSearchAddress } from './hook';

const SearchAddress: FC<{
  onAddressSearch: ({
    address,
    ens,
  }: {
    address?: string;
    ens?: string;
  }) => void;
}> = ({ onAddressSearch }) => {
  const navigation = useNavigation();
  const { network, account } = useActiveWalletAccount();
  const intl = useIntl();
  const { themeVariant } = useTheme();

  const { connectAndCreateExternalAccount } =
    useConnectAndCreateExternalAccount({
      networkId: network?.id ?? '',
    });

  const calculatorAction = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.NFTMarket,
      params: {
        screen: NFTMarketRoutes.CalculatorModal,
        params: undefined,
      },
    });
  }, [navigation]);

  useEffect(() => {
    if (account?.address) {
      onAddressSearch({ address: account?.address });
    }
  }, [account?.address, onAddressSearch]);
  const headerRight = useCallback(
    () => (
      <HStack>
        <IconButton
          mr={{ base: 2.5, md: 8 }}
          type="plain"
          size="lg"
          name="CalculatorOutline"
          circle
          onPress={calculatorAction}
        />
      </HStack>
    ),
    [calculatorAction],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight,
    });
  }, [headerRight, navigation]);
  const [keyword, setKeyword] = useState<string>('');

  const { loading } = useSearchAddress({
    keyword,
    onAddressSearch,
  });
  const isVerticalLayout = useIsVerticalLayout();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (Platform.OS === 'ios') {
      KeyboardManager.setEnable(!isFocused);
    }
    return () => {
      if (Platform.OS === 'ios') {
        KeyboardManager.setEnable(true);
      }
    };
  }, [isFocused]);

  return (
    <Box
      flex={1}
      alignItems="center"
      px="16px"
      pt={{ base: '48px', md: '96px' }}
    >
      {/* <Box w="full" height="106px" bgColor="blue.100" /> */}
      <MotiView
        from={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Image
          width={358}
          height={155}
          source={themeVariant === 'light' ? PnlEmptyImageLight : PnlEmptyImage}
        />
      </MotiView>
      <Text
        textAlign="center"
        typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}
      >
        {intl.formatMessage({ id: 'empty__pnl' })}
      </Text>
      <HStack
        mt="24px"
        w={isVerticalLayout ? 'full' : '400px'}
        justifyContent="center"
      >
        <Input
          flex={1}
          size={isVerticalLayout ? 'xl' : 'default'}
          value={keyword}
          onChangeText={setKeyword}
          leftIconName="SearchOutline"
          numberOfLines={1}
          placeholder={intl.formatMessage({
            id: 'form__enter_address_ens_name',
          })}
          rightCustomElement={
            loading === true ? (
              <Center p={{ base: 2, md: 1 }} maxW="32px" maxH="32px">
                <Spinner size="sm" />
              </Center>
            ) : null
          }
        />
      </HStack>
      <HStack
        w={isVerticalLayout ? 'full' : '400px'}
        mt="24px"
        space="12px"
        alignItems="center"
        justifyContent="center"
      >
        <Box height="1px" bgColor="divider" flex={1} />
        <Text typography="Body2" color="text-subdued">
          OR
        </Text>
        <Box height="1px" bgColor="divider" flex={1} />
      </HStack>

      <Button
        onPress={connectAndCreateExternalAccount}
        type="primary"
        size={isVerticalLayout ? 'lg' : 'base'}
        mt="24px"
      >
        {intl.formatMessage({ id: 'action__connect_wallet' })}
      </Button>
    </Box>
  );
};

export default SearchAddress;
