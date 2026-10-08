import { useIntl } from 'react-intl';

import { Empty, Spinner, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnPositionProtocolList } from './EarnPositionProtocolList';
import { useGroupExpansion } from './GroupRow';

import type { IEarnPositionCardHandlers } from './EarnPositionCard';
import type { IEarnProtocolView } from './earnPositionModel';

export function DeFiAssetsTab({
  protocols,
  isLoading,
  pendingCountByProvider,
  networkFilter,
  onManage,
}: {
  protocols: IEarnProtocolView[];
  isLoading: boolean;
  pendingCountByProvider: Record<string, number>;
  /** the page's network chip; sits right under the tabs on this tab */
  networkFilter: React.ReactNode;
} & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const expansion = useGroupExpansion();

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
      {/* the first protocol opens by default so the page never lands on a
          wall of collapsed rows */}
      <EarnPositionProtocolList
        protocols={protocols}
        expansion={expansion}
        pendingCountByProvider={pendingCountByProvider}
        onManage={onManage}
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
