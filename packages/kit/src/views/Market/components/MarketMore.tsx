import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps, IStackProps } from '@onekeyhq/components';
import { ActionList, IconButton } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useWatchListAction } from './wachListHooks';

function BasicMarketMore({
  coingeckoId,
  ...props
}: { coingeckoId: string } & IStackProps) {
  const intl = useIntl();
  const actions = useWatchListAction();
  const handleRemove = useCallback(() => {
    actions.removeFormWatchList(coingeckoId);
  }, [actions, coingeckoId]);
  const MoveToTop = useCallback(() => {
    actions.MoveToTop(coingeckoId);
  }, [actions, coingeckoId]);
  const sections = useMemo(
    () => [
      {
        items: [
          {
            destructive: true,
            icon: 'DeleteOutline',
            label: intl.formatMessage({
              id: ETranslations.market_remove_from_watchlist,
            }),
            onPress: handleRemove,
          },
          {
            icon: 'ArrowTopOutline',
            label: intl.formatMessage({ id: ETranslations.market_move_to_top }),
            onPress: MoveToTop,
          },
        ] as IActionListItemProps[],
      },
    ],
    [MoveToTop, handleRemove, intl],
  );
  return (
    <ActionList
      title=""
      renderTrigger={
        <IconButton
          icon="DotVerSolid"
          variant="tertiary"
          iconSize="$5"
          {...props}
        />
      }
      sections={sections}
    />
  );
}

export const MarketMore = memo(BasicMarketMore);
