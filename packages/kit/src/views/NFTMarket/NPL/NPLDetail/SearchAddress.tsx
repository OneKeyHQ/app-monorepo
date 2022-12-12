import React, { FC, useCallback, useLayoutEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  Button,
  Center,
  HStack,
  IconButton,
  Input,
  Spinner,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { useActiveWalletAccount } from '../../../../hooks';
import { useConnectAndCreateExternalAccount } from '../../../ExternalAccount/useConnectAndCreateExternalAccount';
import { useDefaultNetWork } from '../../Home/hook';
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
  const { network } = useActiveWalletAccount();

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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: () => (
        <IconButton
          mr="16px"
          type="basic"
          size="sm"
          name="CalculatorSolid"
          circle
          onPress={calculatorAction}
        />
      ),
    });
  }, [calculatorAction, navigation]);
  const [keyword, setKeyword] = useState<string>('');
  const defaultNetWork = useDefaultNetWork();

  const { loading } = useSearchAddress({
    keyword,
    network: defaultNetWork,
    onAddressSearch,
  });
  const isVerticalLayout = useIsVerticalLayout();

  const inputHeight = isVerticalLayout ? '50px' : '38px';
  return (
    <Box
      flex={1}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      px="16px"
    >
      {/* <Box w="full" height="106px" bgColor="blue.100" /> */}
      <Text
        mt="45px"
        textAlign="center"
        typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}
      >
        Analyze your NFT trading history and profits
      </Text>
      <HStack
        mt="24px"
        w={isVerticalLayout ? 'full' : '400px'}
        justifyContent="center"
      >
        <Input
          flex={1}
          h={inputHeight}
          value={keyword}
          onChangeText={setKeyword}
          leftIconName="SearchOutline"
          numberOfLines={1}
          placeholder="Address, domain, or any DID"
        />
        <Center position="absolute" right={0} size={inputHeight}>
          {loading === true ? <Spinner size="sm" /> : null}
        </Center>
      </HStack>
      <HStack
        w={isVerticalLayout ? 'full' : '400px'}
        mt="24px"
        space="12px"
        alignItems="center"
        justifyContent="center"
      >
        <Box height="1px" bgColor="divider" flex={1} />
        <Text>OR</Text>
        <Box height="1px" bgColor="divider" flex={1} />
      </HStack>

      <Button
        onPress={connectAndCreateExternalAccount}
        type="primary"
        size="lg"
        mt="24px"
      >
        Connect Wallet
      </Button>
    </Box>
  );
};

export default SearchAddress;
