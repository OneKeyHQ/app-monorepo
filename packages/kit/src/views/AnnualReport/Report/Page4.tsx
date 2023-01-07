import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, VStack } from '@onekeyhq/components';
import bg from '@onekeyhq/kit/assets/annual/4.png';

import { FormatCurrencyNumber } from '../../../components/Format';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import { Container, WText } from '../components';

import type { HomeRoutesParams } from '../../../routes/types';

const AnnualPage4: FC<{
  height: number;
  params: HomeRoutesParams['AnnualReport'];
}> = ({ height, params: { nfts } }) => {
  const intl = useIntl();
  const { top5, total } = useMemo(() => {
    const all =
      nfts
        ?.map((n) => n.assets)
        ?.flat()
        .sort(
          (a, b) => (b?.latestTradePrice ?? 0) - (a?.latestTradePrice ?? 0),
        ) ?? [];

    return { total: all.length, top5: all.slice(0, 5) };
  }, [nfts]);

  return (
    <Container bg={bg} height={height} showLogo={false}>
      <WText
        fontWeight="600"
        fontSize="32px"
        color="#E2E2E8"
        mb="2"
        lineHeight="45px"
      >
        {intl.formatMessage(
          { id: 'content__eventually_str_jpegs_are_still_in_your_wallet' },
          {
            0: total,
          },
        )}
      </WText>
      <WText
        fontWeight="600"
        fontSize="24px"
        color="#E2E2E8"
        mb="2"
        lineHeight="34px"
      >
        {intl.formatMessage({
          id: 'content__perhaps_you_are_the_only_one_who_knows',
        })}
      </WText>

      <HStack flexWrap="wrap">
        {top5?.slice(0, 5).map((n, i) => {
          const isOdd = i % 2 === 0;
          const rotate = Math.floor(Math.random() * 15) + 15;
          return (
            <Box
              flexDirection="row"
              w="50%"
              justifyContent={isOdd ? 'flex-start' : 'flex-end'}
            >
              <VStack
                key={`${n.contractAddress ?? ''}-${n.tokenId ?? ''}-${
                  n.tokenAddress ?? ''
                }`}
                bg="#fff"
                w="122px"
                p="2"
                style={{
                  transform: [{ rotate: `${isOdd ? '-' : ''}${rotate}deg` }],
                }}
                mb={`${rotate * 2}px`}
              >
                <NFTListImage size={106} asset={n} />
                <WText mt="1" numberOfLines={1} color="#1F1F38" fontSize="12">
                  {`${n.name ?? n.collection.contractName ?? ''}  #${
                    n.tokenId ?? ''
                  }`}
                </WText>
                {n.latestTradePrice ? (
                  <WText
                    numberOfLines={1}
                    color="#1F1F38"
                    fontSize="12"
                    fontWeight="900"
                  >
                    <FormatCurrencyNumber value={n.latestTradePrice} />
                    {`  ${n.latestTradeSymbol ?? ''}`}
                  </WText>
                ) : null}
              </VStack>
            </Box>
          );
        })}
      </HStack>
    </Container>
  );
};

export default AnnualPage4;
