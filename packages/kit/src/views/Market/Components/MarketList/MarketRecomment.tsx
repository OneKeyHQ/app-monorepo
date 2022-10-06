import React, { FC, useState } from 'react';

import { Box, Button, CheckBox, Typography } from '@onekeyhq/components/src';

import RecommendedTokenBox from './RecommendedToken';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

type RecomentTokenType = {
  iconUrl?: string;
  coingeckoId: string;
  name?: string;
  symbol?: string;
};

type MarketRecommentProps = {
  tokens?: RecomentTokenType[];
};
const MarketRecomment: FC<MarketRecommentProps> = ({ tokens }) => {
  const [groupValue, setGroupValue] = useState(() =>
    tokens?.map((t) => t.coingeckoId),
  );
  return (
    <Box flex={1} alignItems="center" justifyContent="center">
      <Box mt="6" maxW="700px">
        <Typography.Heading ml="4">Hot Tokens</Typography.Heading>
        <CheckBox.Group
          defaultValue={groupValue}
          onChange={(values) => {
            setGroupValue(values || []);
          }}
          accessibilityLabel="choose multiple items"
          flexDirection="row"
          alignContent="flex-start"
          flexWrap="wrap"
          width="full"
        >
          {tokens?.map((t) => (
            <Box m="4">
              <RecommendedTokenBox
                name={t.name ?? ''}
                icon={t.iconUrl ?? ''}
                symbol={t.symbol ?? ''}
                coingeckoId={t.coingeckoId ?? ''}
              />
            </Box>
          ))}
        </CheckBox.Group>
        <Button
          size="xl"
          mx="4"
          type="primary"
          isDisabled={!(groupValue && groupValue.length > 0)}
          onPress={() => {
            // 批量添加
            backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens(
              groupValue ?? [],
            );
          }}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
};

export default React.memo(MarketRecomment);
