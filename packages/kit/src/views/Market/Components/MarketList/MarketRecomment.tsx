import type { FC } from 'react';
import { memo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { GRID_MAX_WIDTH } from '../../hooks/useMarketLayout';

import RecommendedTokenBox from './RecommendedToken';

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
  const [groupValue, setGroupValue] = useState<string[]>(
    () => tokens?.map((t) => t.coingeckoId) ?? [],
  );
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  return (
    <Box flex={1} alignItems="center" justifyContent="center">
      <Box mt={isVertical ? '40px' : '56px'} maxW={GRID_MAX_WIDTH}>
        <Box mb="32px" justifyContent="center" alignItems="center">
          <Typography.DisplayLarge>
            {intl.formatMessage({ id: 'empty__your_watchlist_is_empty' })}
          </Typography.DisplayLarge>
          <Typography.Body1 mt={2}>
            {intl.formatMessage({ id: 'empty__your_watchlist_is_empty_desc' })}
          </Typography.Body1>
        </Box>
        <Box
          flexDirection="row"
          alignContent="flex-start"
          flexWrap="wrap"
          width="full"
        >
          {tokens?.map((t, i) => (
            <RecommendedTokenBox
              key={`${t.name ?? 'token'}-i`}
              name={t.name ?? ''}
              icon={t.iconUrl ?? ''}
              symbol={t.symbol ?? ''}
              coingeckoId={t.coingeckoId ?? ''}
              isSelected={groupValue?.includes(t.coingeckoId)}
              onPress={(isSelected) => {
                if (isSelected) {
                  const newGroup = [t.coingeckoId, ...groupValue];
                  setGroupValue(newGroup);
                } else {
                  const newGroup = [...groupValue];
                  newGroup.splice(newGroup.indexOf(t.coingeckoId), 1);
                  setGroupValue(newGroup);
                }
              }}
              index={i}
            />
          ))}
        </Box>
        <Button
          size="xl"
          mt="5"
          type="primary"
          isDisabled={!(groupValue && groupValue.length > 0)}
          onPress={() => {
            if (groupValue?.length) {
              const favorites = groupValue.map((v) => {
                const res = { coingeckoId: v };
                const token = tokens?.find((t) => t.coingeckoId === v);
                if (token) {
                  Object.assign(res, { symbol: token.symbol });
                }
                return res;
              });
              backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens(
                favorites ?? [],
              );
            }
          }}
        >
          {intl.formatMessage(
            {
              id: 'action__add_str_tokens',
            },
            { '0': `${groupValue?.length ?? 0}` },
          )}
        </Button>
      </Box>
    </Box>
  );
};

export default memo(MarketRecomment);
