import type { FC } from 'react';
import { useMemo } from 'react';

import B from 'bignumber.js';
import { useAsync } from 'react-async-hook';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  Pressable,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';
import bg1 from '@onekeyhq/kit/assets/annual/1.jpg';
import bgLoading from '@onekeyhq/kit/assets/annual/bg_loading.png';
import bgStart from '@onekeyhq/kit/assets/annual/bg_start.png';
import empty from '@onekeyhq/kit/assets/annual/empty.png';
import emptyBg from '@onekeyhq/kit/assets/annual/empty_bg.jpg';
import { parsePNLData } from '@onekeyhq/kit/src/views/NFTMarket/PNL/PNLDetail';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation, useNavigationActions } from '../../hooks';
import { HomeRoutes, RootRoutes } from '../../routes/types';

import {
  BgButton,
  Container,
  Footer,
  WText,
  useHeaderHide,
} from './components';
import { useEvmAccount } from './hooks';

import type { HomeRoutesParams, RootRoutesParams } from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.AnnualReport>;
const AnnualLoading: FC = () => {
  useHeaderHide();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { openAccountSelector } = useNavigationActions();
  const account = useEvmAccount();
  const networkId = OnekeyNetwork.eth;

  const { result: ens, loading: ensLoading } = useAsync(async () => {
    if (account?.address) {
      return backgroundApiProxy.serviceRevoke.lookupEnsName(account.address);
    }
    return '';
  }, [account?.address]);

  const { result: tokens, loading: tokensLoading } = useAsync(async () => {
    if (!account?.id) {
      return [];
    }
    const accountId = account.id;
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
    const balances = await serviceToken.fetchTokenBalance({
      activeAccountId: accountId,
      activeNetworkId: networkId,
    });

    return accountTokens
      .map((t) => {
        const balance = balances[t.tokenIdOnNetwork || 'main'];
        const price =
          prices[
            t.tokenIdOnNetwork
              ? `${networkId}-${t.tokenIdOnNetwork}`
              : networkId
          ]?.usd;

        const value = new B(balance ?? '0').multipliedBy(price ?? 0);
        return {
          ...t,
          price,
          balance,
          value,
        };
      })
      .sort((a, b) => b.value.minus(a.value).toNumber())
      .filter((t) => t.value.isGreaterThan(0));
  }, [networkId, account?.id]);

  const { result: nfts, loading: nftLoading } = useAsync(async () => {
    if (!account?.address) {
      return [];
    }
    return backgroundApiProxy.serviceNFT.fetchNFT({
      accountId: account.address,
      networkId,
    });
  }, [account?.address, networkId]);

  const { result: pnls, loading: pnlLoading } = useAsync(async () => {
    const { serviceNFT } = backgroundApiProxy;
    if (!account?.address) {
      return;
    }
    const data = await serviceNFT.getPNLData({
      address: account?.address,
    });
    const parsed = parsePNLData(data ?? []);
    const top5 =
      parsed?.content?.sort((a, b) => b.profit - a.profit).slice(0, 5) ?? [];

    let assets: NFTAsset[] = [];

    if (top5.length) {
      assets =
        (await serviceNFT.batchAsset({
          chain: networkId,
          items: top5.map((item) => ({
            contract_address: item.contractAddress,
            token_id: item.tokenId,
          })),
        })) ?? [];
    }

    return {
      data: {
        ...(parsed || {}),
        content: top5,
      },
      assets: assets?.reduce((m, n) => {
        const key = `${n.contractAddress as string}-${n.tokenId as string}`;
        return {
          ...m,
          [key]: n,
        };
      }, {}),
    };
  }, [account?.address]);

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

  const isDone = useMemo(() => loading >= 100, [loading]);

  const name = useMemo(() => {
    if (ens) {
      return ens;
    }
    return shortenAddress(account?.address ?? '');
  }, [ens, account?.address]);

  const button = useMemo(() => {
    if (!isDone) {
      return (
        <BgButton w={134} h={32} bg={bgLoading}>
          <WText
            textTransform="none"
            fontSize="16"
            fontWeight="600"
            color="#34C759"
          >
            {intl.formatMessage(
              { id: 'content__loading' },
              {
                0: `${loading}%`,
              },
            )}
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
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
          navigation.navigate(RootRoutes.Root, {
            screen: HomeRoutes.AnnualReport,
            params: {
              name,
              tokens,
              nfts,
              pnls,
            },
          });
        }}
      >
        <WText fontSize="16" fontWeight="600">
          START
        </WText>
      </BgButton>
    );
  }, [intl, loading, isDone, navigation, tokens, nfts, pnls, name]);

  if (!name) {
    return (
      <Container
        bg={emptyBg}
        containerProps={{
          position: 'relative',
          px: 0,
          flexDirection: 'column',
        }}
      >
        <WText
          useCustomFont
          fontWeight="600"
          fontSize="24px"
          lineHeight="34px"
          px="6"
        >
          {intl.formatMessage({
            id: 'content__in_2022_you_dont_have_a_story_left_on_the_chain',
          })}
        </WText>
        <Center flex="1">
          <Image source={empty} w={300} h={300} />
        </Center>
        <Footer />
      </Container>
    );
  }

  return (
    <Container bg={bg1}>
      <VStack flex="1" flexDirection="column-reverse">
        <WText fontSize="48" useCustomFont>
          {intl.formatMessage({ id: 'title__my_on_chain_journey_uppercase' })}
        </WText>
      </VStack>
      {name ? (
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
                <Icon name="ChevronDownMini" color="text-on-primary" />
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
              w="full"
            >
              {intl.formatMessage({
                id: 'content__check_out_what_s_your_identity_on_the_blockchain',
              })}
            </WText>
          </Box>
        </Center>
      ) : null}
      <Center w="full" mt={name ? '7' : '162px'} mb="72px">
        {button}
      </Center>
      <WText
        fontSize="10"
        color="text-subdued"
        fontWeight="400"
        textTransform="none"
        textAlign="center"
        lineHeight="20px"
      >
        {intl.formatMessage({
          id: 'content__the_statistical_scope_is_limited_to_eth_networks_all_data_comes_from_the_blockchain_browser',
        })}
      </WText>
    </Container>
  );
};

export default AnnualLoading;
