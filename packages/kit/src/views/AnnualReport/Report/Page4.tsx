import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { HStack, VStack } from '@onekeyhq/components';

import { FormatCurrencyNumber } from '../../../components/Format';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import { WText } from '../components';

import type { PageProps } from '../types';

const styles = [
  {
    transform: [{ rotate: '-14deg' }],
    bottom: 0,
    left: 24,
  },
  {
    transform: [{ rotate: '16deg' }],
    bottom: 170,
    right: 10,
  },
  {
    transform: [{ rotate: '20deg' }],
    bottom: -40,
    right: 0,
  },
  {
    transform: [{ rotate: '-10deg' }],
    top: 140,
    left: 16,
  },
  {
    transform: [{ rotate: '-23deg' }],
    top: 0,
    right: -40,
  },
];

const AnnualPage4: FC<PageProps> = ({ params: { nfts } }) => {
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
    <>
      <WText
        fontWeight="600"
        fontSize="32px"
        color="#E2E2E8"
        mb="2"
        lineHeight="45px"
      >
        {total > 0
          ? intl.formatMessage(
              { id: 'content__eventually_str_jpegs_are_still_in_your_wallet' },
              {
                0: total,
              },
            )
          : intl.formatMessage({
              id: 'content__you_dont_have_any_nft_in_your_wallet',
            })}
      </WText>
      <WText
        fontWeight="600"
        fontSize="24px"
        color="#E2E2E8"
        mb="2"
        lineHeight="34px"
        zIndex="2"
        w="279px"
      >
        {total > 0
          ? intl.formatMessage({
              id: 'content__perhaps_you_are_the_only_one_who_knows',
            })
          : intl.formatMessage({
              id: 'content__nft_market_will_boom_or_bust_that_s_a_question',
            })}
      </WText>

      <HStack zIndex="1" position="relative" flex="1" top="-100px">
        {top5?.slice(0, 5).map((n, i) => (
          <VStack
            key={`${n.contractAddress ?? ''}-${n.tokenId ?? ''}-${
              n.tokenAddress ?? ''
            }`}
            bg="#fff"
            w="122px"
            p="2"
            position="absolute"
            style={styles[i]}
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
        ))}
      </HStack>
    </>
  );
};

export default AnnualPage4;
