import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type {
  IActionListItemProps,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';
import { ActionList, IconButton } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useReviewControl } from '../../../components/ReviewControl';

import { useLazyMarketTradeActions } from './tradeHook';
import { useWatchListAction } from './watchListHooks';

function BasicMarketMore({
  coingeckoId,
  symbol,
  showMoreAction,
  isSupportBuy,
  ...props
}: {
  coingeckoId: string;
  symbol: string;
  isSupportBuy: boolean;
  showMoreAction: boolean;
} & IStackProps) {
  const intl = useIntl();
  const actions = useWatchListAction();
  const MoveToTop = useCallback(async () => {
    await actions.MoveToTop(coingeckoId);
  }, [actions, coingeckoId]);
  const tradeActions = useLazyMarketTradeActions(coingeckoId);
  const show = useReviewControl();
  const sections = useMemo(
    () =>
      [
        showMoreAction && {
          items: [
            {
              icon: 'ArrowTopOutline',
              label: intl.formatMessage({
                id: ETranslations.market_move_to_top,
              }),
              onPress: MoveToTop,
            },
          ] as IActionListItemProps[],
        },
        show && isSupportBuy
          ? {
              items: [
                {
                  icon: 'MinusLargeSolid',
                  label: intl.formatMessage({ id: ETranslations.global_sell }),
                  onPress: () => {
                    defaultLogger.market.token.marketTokenAction({
                      tokenName: coingeckoId,
                      action: 'sell',
                      from: 'listPage',
                    });
                    tradeActions.onSell();
                  },
                },
              ] as IActionListItemProps[],
            }
          : undefined,
      ].filter(Boolean),
    [
      MoveToTop,
      coingeckoId,
      intl,
      isSupportBuy,
      show,
      showMoreAction,
      tradeActions,
    ],
  );
  return (
    <ActionList
      title=""
      renderTrigger={
        <IconButton
          title={intl.formatMessage({ id: ETranslations.global_more })}
          icon="DotVerSolid"
          variant="tertiary"
          iconSize="$5"
          disabled={sections.length === 0}
          {...(props as IXStackProps)}
        />
      }
      sections={sections}
    />
  );
}

export const MarketMore = memo(BasicMarketMore);
