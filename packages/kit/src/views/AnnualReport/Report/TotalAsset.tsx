import type { FC } from 'react';
import { useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import { FormatCurrencyNumber } from '@onekeyhq/kit/src/components/Format';

import { useAppSelector } from '../../../hooks';
import { useNFTPrice } from '../../../hooks/useTokens';
import { WText } from '../components';

import type { PageProps } from '../types';

const TotalAsset: FC<PageProps> = ({
  params: { tokens, networkId, account },
}) => {
  const intl = useIntl();

  const nftValue = useNFTPrice({
    networkId,
    accountId: account.address,
  });

  const totalValue = useMemo(
    () =>
      (tokens?.reduce((v, n) => v.plus(n.value), new B(0)) ?? new B(0)).plus(
        nftValue,
      ),
    [tokens, nftValue],
  );

  const btcPrice = useAppSelector((s) => s.fiatMoney?.map?.btc?.value ?? 0);

  const hasNoAsset = useMemo(() => totalValue.isEqualTo(0), [totalValue]);

  return (
    <>
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
        useCustomFont
      >
        $<FormatCurrencyNumber value={totalValue} onlyNumber />
      </WText>
      {hasNoAsset ? null : (
        <WText fontWeight="600" fontSize="24px" color="#E2E2E8" mb="2">
          {intl.formatMessage(
            { id: 'content__equivalent_to_str_btc' },
            {
              0: (
                <FormatCurrencyNumber
                  onlyNumber
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
          {intl.formatMessage({
            id: 'content__zero_is_not_the_end_it_s_a_brand_new_start',
          })}
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
        useCustomFont
      >
        #HYOK
      </WText>
    </>
  );
};

export default TotalAsset;
