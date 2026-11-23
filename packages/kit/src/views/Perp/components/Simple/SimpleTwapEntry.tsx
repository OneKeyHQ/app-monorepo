import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useOrderFilterByCurrentTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { simplePerpsCardStyle } from './simpleStyles';

export function SimpleTwapEntry({ count }: { count: number }) {
  const intl = useIntl();
  const actions = useHyperliquidActions();
  const [submitting] = useTradingLoadingAtom();
  const [, setSettings] = usePerpsCustomSettingsAtom();
  const [, setFilterByCurrentToken] = useOrderFilterByCurrentTokenAtom();
  const open = useCallback(() => {
    if (submitting) return;
    setFilterByCurrentToken(false);
    actions.current.setTradeRouteViewState({
      infoPanelTab: 'OpenOrders',
      openOrdersSubTab: 'twap',
    });
    setSettings((previous) => ({
      ...previous,
      mobileTradingMode: 'pro',
    }));
  }, [actions, setFilterByCurrentToken, setSettings, submitting]);

  if (count === 0) return null;

  return (
    <Button
      testID="perps-simple-twap-entry"
      {...simplePerpsCardStyle}
      borderRadius="$6"
      px="$4"
      py="$3"
      childrenAsText={false}
      disabled={submitting}
      onPress={open}
    >
      <XStack flex={1} gap="$2" alignItems="center">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.perp_twap_orders__title })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {count}
        </SizableText>
        <XStack flex={1} />
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.dexmarket_pro })}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </Button>
  );
}
