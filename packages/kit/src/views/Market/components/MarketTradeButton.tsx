import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList, Button, IconButton, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { useMarketTradeActions } from './tradeHook';

export function MarketTradeButton({
  token,
}: {
  coinGeckoId: string;
  token: IMarketTokenDetail;
}) {
  const intl = useIntl();

  const { onSwap, onStaking, onBuy, onSell, canStaking } =
    useMarketTradeActions(token);

  const sections = useMemo(
    () => [
      {
        items: [
          {
            icon: 'MinusLargeSolid',
            label: intl.formatMessage({ id: ETranslations.global_sell }),
            onPress: onSell,
          },
        ] as IActionListItemProps[],
      },
    ],
    [intl, onSell],
  );

  return (
    <XStack $gtMd={{ mt: '$6' }} ai="center" gap="$4">
      <XStack gap="$2.5" flex={1}>
        <Button flex={1} variant="primary" onPress={onSwap}>
          {intl.formatMessage({ id: ETranslations.global_trade })}
        </Button>
        {canStaking ? (
          <Button flex={1} variant="secondary" onPress={onStaking}>
            {intl.formatMessage({ id: ETranslations.earn_stake })}
          </Button>
        ) : null}
        <Button flex={1} variant="secondary" onPress={onBuy}>
          {intl.formatMessage({ id: ETranslations.global_buy })}
        </Button>
      </XStack>
      <ActionList
        title={token.symbol.toUpperCase() || ''}
        renderTrigger={
          <IconButton
            title={intl.formatMessage({ id: ETranslations.global_more })}
            icon="DotVerSolid"
            variant="tertiary"
            iconSize="$5"
          />
        }
        sections={sections}
      />
    </XStack>
  );
}
