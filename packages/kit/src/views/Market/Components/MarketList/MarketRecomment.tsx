import React, { FC, useState } from 'react';

import {
  Box,
  Button,
  CheckBox,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';

import RecommendedTokenBox from './RecommendedToken';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { GRID_MAX_WIDTH } from '../../hooks/useMarketLayout';

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
  const isVertical = useIsVerticalLayout();
  return (
    <Box flex={1} alignItems="center" justifyContent="center">
      <Box mt={isVertical ? '6' : '14'} maxW={GRID_MAX_WIDTH}>
        <Typography.Heading>Hot Tokens</Typography.Heading>
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
          {tokens?.map((t, i) => (
            <RecommendedTokenBox
              name={t.name ?? ''}
              icon={t.iconUrl ?? ''}
              symbol={t.symbol ?? ''}
              coingeckoId={t.coingeckoId ?? ''}
              index={i}
            />
          ))}
        </CheckBox.Group>
        <Button
          size="xl"
          mt="5"
          type="primary"
          isDisabled={!(groupValue && groupValue.length > 0)}
          onPress={() => {
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
