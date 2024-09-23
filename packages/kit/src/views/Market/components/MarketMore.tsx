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
  const MoveToTop = useCallback(() => {
    actions.MoveToTop(coingeckoId);
  }, [actions, coingeckoId]);
  const sections = useMemo(
    () => [
      {
        items: [
          {
            icon: 'ArrowTopOutline',
            label: intl.formatMessage({ id: ETranslations.market_move_to_top }),
            onPress: MoveToTop,
          },
        ] as IActionListItemProps[],
      },
    ],
    [MoveToTop, intl],
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
          {...props}
        />
      }
      sections={sections}
    />
  );
}

export const MarketMore = memo(BasicMarketMore);
