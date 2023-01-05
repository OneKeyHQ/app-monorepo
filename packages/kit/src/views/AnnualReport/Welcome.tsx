import type { FC } from 'react';
import { useMemo } from 'react';

import { useAsync } from 'react-async-hook';

import {
  Box,
  Center,
  HStack,
  Icon,
  Pressable,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import bg1 from '@onekeyhq/kit/assets/annual/1.png';
import bgLoading from '@onekeyhq/kit/assets/annual/bg_loading.png';
import bgStart from '@onekeyhq/kit/assets/annual/bg_start.png';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useNavigation,
  useNavigationActions,
} from '../../hooks';
import { HomeRoutes } from '../../routes/types';

import { BgButton, Container, WText, useHeaderHide } from './components';

import type {
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.AnnualReport>;
const AnnualLoading: FC = () => {
  useHeaderHide();
  const navigation = useNavigation<NavigationProps>();
  const { openAccountSelector } = useNavigationActions();
  const { accountAddress, accountId, networkId } = useActiveWalletAccount();
  const { result: ens, loading: ensLoading } = useAsync(
    async () => backgroundApiProxy.serviceRevoke.lookupEnsName(accountAddress),
    [accountAddress],
  );

  const { result: tokens, loading: tokensLoading } = useAsync(async () => {
    const { servicePrice, serviceToken } = backgroundApiProxy;
    const res = await serviceToken.fetchAccountTokens({
      activeNetworkId: networkId,
      activeAccountId: accountId,
      withBalance: true,
      wait: true,
    });
    const accountTokens = res.filter((n) => !n.security);
    const prices = await servicePrice.fetchSimpleTokenPrice({
      networkId,
      accountId,
      tokenIds: accountTokens.map((t) => t.tokenIdOnNetwork),
      vsCurrency: 'usd',
    });
    const balances = serviceToken.fetchTokenBalance({
      activeAccountId: accountId,
      activeNetworkId: networkId,
    });
    return {
      prices,
      balances,
      accountTokens,
    };
  }, [networkId, accountId]);

  const { result: nfts, loading: nftLoading } = useAsync(
    async () =>
      backgroundApiProxy.serviceNFT.fetchNFT({
        accountId: accountAddress,
        networkId,
      }),
    [accountAddress, networkId],
  );

  const { result: pnls, loading: pnlLoading } = useAsync(
    async () =>
      backgroundApiProxy.serviceNFT.getPNLData({ address: accountAddress }),
    [accountAddress],
  );

  console.log(ens, 'ens result');

  console.log(tokens?.prices, 'prices');

  console.log(tokens?.accountTokens.length, 'tokens');

  console.log(nfts?.length, 'nfts');

  console.log(pnls?.length, 'pnls');

  const loading = useMemo(() => {
    const pipeline = [ensLoading, tokensLoading, nftLoading, pnlLoading];
    const progress = pipeline.reduce((p, n) => {
      if (!n) {
        return p + 100 / pipeline.length;
      }
      return p;
    }, 0);
    return Math.floor(progress);
  }, [ensLoading, tokensLoading, nftLoading, pnlLoading]);

  const isDone = loading >= 100;

  const name = useMemo(() => {
    if (ens) {
      return ens;
    }
    return shortenAddress(accountAddress);
  }, [ens, accountAddress]);

  const button = useMemo(() => {
    if (loading !== 100) {
      return (
        <BgButton w={134} h={32} bg={bgLoading}>
          <WText
            textTransform="none"
            fontSize="16"
            fontWeight="600"
            color="#34C759"
          >
            Loading...{loading}%
          </WText>
        </BgButton>
      );
    }
    return (
      <BgButton
        w={196}
        h={50}
        bg={bgStart}
        onPress={() => {
          navigation.navigate(HomeRoutes.AnnualReport);
        }}
      >
        <WText fontSize="16" fontWeight="600">
          START
        </WText>
      </BgButton>
    );
  }, [loading, navigation]);

  return (
    <Container bg={bg1} showLogo showFooter={false}>
      <VStack flex="1" flexDirection="column-reverse">
        <WText fontSize="48">Journey.</WText>
        <WText fontSize="48">on-chain</WText>
        <WText fontSize="48">My</WText>
      </VStack>
      {isDone ? (
        <Center w="full" mt="37px">
          <HStack alignItems="center">
            <Pressable
              onPress={() => {
                openAccountSelector({});
              }}
            >
              <HStack alignItems="center">
                <WText mr="2" fontSize="24" textTransform="none">
                  Hi, {name}
                </WText>
                <Icon name="PencilSquareSolid" color="text-on-primary" />
              </HStack>
            </Pressable>
          </HStack>
          <Box
            borderLeftWidth="4px"
            borderRightWidth="4px"
            borderColor="rgba(68, 132, 96, 0.46)"
            px="1"
            height="25px"
            mt="7"
          >
            <WText
              fontSize="16"
              lineHeight="25px"
              textTransform="none"
              fontWeight="400"
            >
              看看你的链上身份是什么？
            </WText>
          </Box>
        </Center>
      ) : null}
      <Center w="full" mt={isDone ? '7' : '162px'} mb="72px">
        {button}
      </Center>
      <WText
        fontSize="10"
        color="text-subdued"
        fontWeight="400"
        textTransform="none"
        textAlign="center"
        lineHeight="20px"
        mb={platformEnv.isNativeAndroid ? '38px' : 0}
      >
        {`统计范围仅限于 ETH 网络\n所有数据都来自于区块链浏览器，OneKey不会保存任何用户的隐私数据。`}
      </WText>
    </Container>
  );
};

export default AnnualLoading;
