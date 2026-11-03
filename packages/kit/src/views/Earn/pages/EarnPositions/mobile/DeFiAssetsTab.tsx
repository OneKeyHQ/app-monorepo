import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Spinner, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useCardFocus, useFocusRequestOnce } from '../useCardFocus';

import { EarnPositionProtocolList } from './EarnPositionProtocolList';
import { useGroupExpansion } from './GroupRow';

import type { IEarnPositionCardHandlers } from './EarnPositionCard';
import type { IEarnProtocolView } from './earnPositionModel';

export function DeFiAssetsTab({
  focusCardRequest,
  protocols,
  isLoading,
  pendingCountByProvider,
  networkFilter,
  onManage,
  onRedeem,
  onWarmRedeem,
}: {
  /** A Your loans card: its market's card, opened and scrolled to (web) */
  focusCardRequest?: { cardKeys: string[]; at: number };
  protocols: IEarnProtocolView[];
  isLoading: boolean;
  pendingCountByProvider: Record<string, number>;
  /** the page's network chip; sits right under the tabs on this tab */
  networkFilter: React.ReactNode;
} & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const expansion = useGroupExpansion();
  // As in the wide layout: the group opens, the page scrolls to it and its
  // header lights up
  const { flashKeys, registerAnchor, scrollToCards } = useCardFocus({
    isOpen: expansion.isExpanded,
    open: expansion.open,
  });
  useFocusRequestOnce(
    focusCardRequest,
    useCallback(
      (request: { cardKeys: string[] }) => scrollToCards(request.cardKeys),
      [scrollToCards],
    ),
  );

  let placeholder: React.ReactNode = null;
  if (protocols.length === 0) {
    placeholder = isLoading ? (
      <Stack ai="center" py="$8">
        <Spinner size="large" />
      </Stack>
    ) : (
      // Product: same illustration and title as the existing page, without
      // its subtitle (earn_no_orders_desc repeats the title).
      <Empty
        illustration="BlockPercentage"
        title={intl.formatMessage({
          id: ETranslations.earn_no_assets_deposited,
        })}
      />
    );
  }

  return (
    <YStack gap="$4" pb="$2">
      <Stack px="$5" pt="$3" ai="flex-start">
        {networkFilter}
      </Stack>
      {placeholder}
      <EarnPositionProtocolList
        protocols={protocols}
        expansion={expansion}
        registerAnchor={registerAnchor}
        flashKeys={flashKeys}
        pendingCountByProvider={pendingCountByProvider}
        onManage={onManage}
        onRedeem={onRedeem}
        onWarmRedeem={onWarmRedeem}
      />
      {/* scopes still landing behind the rows already shown */}
      {isLoading && protocols.length > 0 ? (
        <Stack ai="center" py="$4">
          <Spinner size="small" />
        </Stack>
      ) : null}
    </YStack>
  );
}
