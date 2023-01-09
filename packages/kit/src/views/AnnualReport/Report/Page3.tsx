import type { FC } from 'react';
import { useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import { HStack, VStack } from '@onekeyhq/components';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import { useActiveWalletAccount } from '../../../hooks';
import { PriceString } from '../../NFTMarket/PriceText';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import { WText } from '../components';

import type { PageProps } from '../types';

const AnnualPage3: FC<PageProps> = ({ params: { pnls } }) => {
  const { data, assets } = pnls ?? {};
  const intl = useIntl();
  const { networkId } = useActiveWalletAccount();

  const total = useMemo(() => {
    let totalValue = '0';
    if (data?.totalProfit) {
      totalValue = data?.totalProfit?.decimalPlaces(3).toString();
      totalValue = `${
        data?.totalProfit?.toNumber() >= 0 ? '+' : ''
      }${totalValue}`;
    }
    return PriceString({ price: totalValue, networkId });
  }, [data, networkId]);

  const items = useMemo(
    () =>
      data?.content.map((n) => {
        const key = `${n.contractAddress as string}-${n.tokenId}`;
        return {
          ...n,
          key,
          asset: assets?.[key],
        };
      }) ?? [],
    [data, assets],
  );

  if (!pnls) {
    return null;
  }

  return (
    <>
      <WText
        fontWeight="600"
        fontSize="32px"
        color="#E2E2E8"
        mb="2"
        lineHeight="45px"
      >
        {intl.formatMessage({
          id: 'content__you_who_love_nft_the_most_have_also_gained_a_lot_this_year',
        })}
      </WText>
      <HStack mt="6">
        <VStack flex="1">
          <WText
            fontWeight="800"
            fontSize="20px"
            lineHeight="28px"
            color="#E2E2E8"
            mb="2"
          >
            {intl.formatMessage({ id: 'content__spent' })}
          </WText>
          <WText
            fontWeight="bold"
            fontSize="24px"
            lineHeight="29px"
            color="#E2E2E8"
            mb="2"
          >
            {PriceString({
              price: data?.spend?.decimalPlaces(3).toString() ?? '',
              networkId,
            })}
          </WText>
        </VStack>
        <VStack flex="1">
          <WText
            fontWeight="800"
            fontSize="20px"
            lineHeight="28px"
            color="#E2E2E8"
            mb="2"
          >
            {intl.formatMessage({ id: 'content__profit' })}
          </WText>
          <WText
            fontWeight="bold"
            fontSize="24px"
            lineHeight="29px"
            color="#E2E2E8"
            mb="6"
          >
            {total}
          </WText>
        </VStack>
      </HStack>
      {items.map((item) => (
        <HStack alignItems="center" mb="6">
          <NFTListImage asset={item.asset || ({} as NFTAsset)} size={80} />
          <VStack ml="6">
            <WText
              fontWeight="600"
              fontSize="20px"
              lineHeight="28px"
              color="#E2E2E8"
              mb="2"
            >
              {`${item.contractName ?? ''}  #${item.tokenId ?? ''}`}
            </WText>
            <WText
              fontWeight="600"
              fontSize="20px"
              lineHeight="28px"
              color="text-success"
            >
              {PriceString({
                price:
                  new B(item?.profit || 0).decimalPlaces(3).toString() ?? '',
                networkId,
              })}
            </WText>
          </VStack>
        </HStack>
      ))}
    </>
  );
};

export default AnnualPage3;
