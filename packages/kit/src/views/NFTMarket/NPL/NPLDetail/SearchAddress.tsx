import React, { FC, useLayoutEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  Button,
  Center,
  HStack,
  Input,
  Spinner,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { HomeRoutes } from '../../../../routes/routesEnum';
import { HomeRoutesParams } from '../../../../routes/types';
import { useDefaultNetWork } from '../../Home/hook';

import { useSearchAddress } from './hook';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.NFTNPLScreen
>;

const SearchAddress: FC<{
  onAddressSearch: ({
    address,
    ens,
  }: {
    address?: string;
    ens?: string;
  }) => void;
}> = ({ onAddressSearch }) => {
  const navigation = useNavigation<NavigationProps>();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
    });
  }, [navigation]);
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

      <Button type="primary" size="lg" mt="24px">
        Connect Wallet
      </Button>
    </Box>
  );
};

export default SearchAddress;
