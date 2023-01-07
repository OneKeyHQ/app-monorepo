import type { FC } from 'react';
import { useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Divider } from '@onekeyhq/components';
import bg from '@onekeyhq/kit/assets/annual/2.png';
import { FormatCurrencyNumber } from '@onekeyhq/kit/src/components/Format';

import { useActiveWalletAccount, useAppSelector } from '../../../hooks';
import { useNFTPrice } from '../../../hooks/useTokens';
import { Container, WText } from '../components';

import type { HomeRoutesParams } from '../../../routes/types';

const AnnualPage1: FC<{
  height: number;
  params: HomeRoutesParams['AnnualReport'];
}> = ({ height, params: { tokens } }) => {
  const intl = useIntl();

  const { networkId, accountAddress } = useActiveWalletAccount();

  const nftValue = useNFTPrice({
    networkId,
    accountId: accountAddress,
  });

  const totalValue = useMemo(
    () =>
      (tokens?.reduce((v, n) => v.plus(n.value), new B(0)) ?? new B(0)).plus(
        nftValue,
      ),
    [tokens, nftValue],
  );

  const btcPrice = useAppSelector((s) => s.fiatMoney?.map?.btc ?? 0);

  const hasNoAsset = useMemo(() => totalValue.isEqualTo(0), [totalValue]);

  return (
    <Container bg={bg} height={height} showLogo={false}>
      <WText
        fontWeight="600"
        fontSize="24px"
        color="#E2E2E8"
        mb="2"
        lineHeight="34px"
      >
        {intl.formatMessage({ id: 'content__your_total_assets' })}
      </WText>
      <WText
        fontWeight="800"
        fontSize="40px"
        lineHeight="48px"
        color="#E2E2E8"
        mb="2"
      >
        <FormatCurrencyNumber value={totalValue} />
      </WText>
      {hasNoAsset ? null : (
        <WText fontWeight="600" fontSize="24px" color="#E2E2E8" mb="2">
          {intl.formatMessage(
            { id: 'content__equivalent_to_str_btc' },
            {
              0: (
                <FormatCurrencyNumber
                  value={totalValue.multipliedBy(btcPrice)}
                />
              ),
            },
          )}
        </WText>
      )}
      {hasNoAsset ? (
        <WText
          fontWeight="600"
          fontSize="24px"
          lineHeight="34px"
          color="#E2E2E8"
          mb="2"
          mt="6"
        >
          积微而著，由著复微。 零不是终点， 而是全新的起点。
        </WText>
      ) : (
        <WText
          fontWeight="600"
          fontSize="24px"
          lineHeight="34px"
          color="#E2E2E8"
          mb="2"
          mt="6"
        >
          {intl.formatMessage({
            id: 'content__although_you_re_not_rich_as_elon',
          })}
        </WText>
      )}
      <WText
        fontWeight="800"
        fontSize="40px"
        color="#E2E2E8"
        mb="2"
        lineHeight="48px"
        mt="8"
      >
        #HYOK
      </WText>
    </Container>
  );
};

export default AnnualPage1;
