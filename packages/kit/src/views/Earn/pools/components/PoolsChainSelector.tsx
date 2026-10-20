import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { MoreButton } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenListNetworkSelector/MoreButton';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ROBINHOOD_NETWORK_ID } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IServerNetwork } from '@onekeyhq/shared/types';

/** The chains the pill always shows, in this order; the rest sit in its list */
const QUICK_NETWORK_IDS = [
  getNetworkIdsMap().bsc,
  getNetworkIdsMap().eth,
  ROBINHOOD_NETWORK_ID,
  getNetworkIdsMap().base,
];

/**
 * Market's compact chain selector for the pools list: All, the quick chains
 * as icons, then the full list with search. One chain at a time.
 */
export function PoolsChainSelector({
  value,
  onChange,
  networkCounts,
  testID = 'earn-pools-chain-selector',
}: {
  /** The chain shown; absent for every chain */
  value?: string;
  onChange: (networkId: string | undefined) => void;
  /** Pools per chain: only chains with pools are offered, the most first */
  networkCounts: Record<string, number>;
  testID?: string;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  // Market sizes the pill for a pointer; fingers get bigger targets
  const large = platformEnv.isNative || !gtMd;
  const allNetworkId = getNetworkIdsMap().onekeyall;

  const listIds = useMemo(() => {
    const withPools = Object.keys(networkCounts);
    const quick = QUICK_NETWORK_IDS.filter((id) => withPools.includes(id));
    const rest = withPools
      .filter((id) => !QUICK_NETWORK_IDS.includes(id))
      .toSorted((a, b) => (networkCounts[b] ?? 0) - (networkCounts[a] ?? 0));
    return [...quick, ...rest];
  }, [networkCounts]);

  const { result: networks } = usePromiseResult(
    async () => {
      const resp = await backgroundApiProxy.serviceNetwork.getNetworksByIds({
        networkIds: [allNetworkId, ...listIds],
      });
      return resp.networks;
    },
    [allNetworkId, listIds],
    { initResult: [] as IServerNetwork[] },
  );

  const networkById = useMemo(
    () => new Map(networks.map((network) => [network.id, network])),
    [networks],
  );
  // The list keeps the pill's order, All networks first
  const listNetworks = useMemo(
    () =>
      [allNetworkId, ...listIds]
        .map((id) => networkById.get(id))
        .filter((network): network is IServerNetwork => Boolean(network)),
    [allNetworkId, listIds, networkById],
  );

  const quickIds = useMemo(() => {
    const ids = QUICK_NETWORK_IDS.filter((id) => listIds.includes(id));
    // A chain picked from the list joins the pill, as on Market
    return value && !ids.includes(value) ? [...ids, value] : ids;
  }, [listIds, value]);

  const handleListSelect = useCallback(
    (network: IServerNetwork) => {
      onChange(network.isAllNetworks ? undefined : network.id);
    },
    [onChange],
  );

  const moreTrigger = useCallback(
    (isOpen: boolean, onPress: () => void): ReactNode => (
      <Stack
        testID="earn-pools-chain-more"
        p={large ? '$2' : '$1'}
        borderRadius="$full"
        hoverStyle={{ bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
        onPress={onPress}
        cursor="pointer"
        userSelect="none"
      >
        <Icon
          name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
          size="$4"
          color="$iconSubdued"
        />
      </Stack>
    ),
    [large],
  );

  const isAll = !value;
  const iconSize = large ? 20 : 17;

  return (
    <XStack
      testID={testID}
      bg="$bgStrong"
      borderRadius="$full"
      p="$0.5"
      gap="$1"
      ai="center"
      flexShrink={0}
    >
      <Stack
        testID="earn-pools-chain-all"
        px={large ? '$2.5' : '$2'}
        py={large ? '$1.5' : '$1'}
        borderRadius="$full"
        bg={isAll ? '$bgActive' : '$transparent'}
        focusable
        hoverStyle={isAll ? undefined : { bg: '$bgStrongHover' }}
        pressStyle={isAll ? undefined : { bg: '$bgStrongActive' }}
        onPress={() => onChange(undefined)}
        cursor="pointer"
        userSelect="none"
      >
        <SizableText
          size={large ? '$bodyMdMedium' : '$bodySm'}
          color={isAll ? '$text' : '$textSubdued'}
        >
          {intl.formatMessage({ id: ETranslations.global_all })}
        </SizableText>
      </Stack>
      {quickIds.map((id) => {
        const network = networkById.get(id);
        if (!network) {
          return null;
        }
        const isSelected = value === id;
        const chip = (
          <Stack
            key={id}
            testID={`earn-pools-chain-${id}`}
            p={large ? '$1.5' : '$1'}
            borderRadius="$full"
            bg={isSelected ? '$neutral6' : '$transparent'}
            focusable
            hoverStyle={isSelected ? undefined : { bg: '$bgStrongHover' }}
            pressStyle={isSelected ? undefined : { bg: '$bgStrongActive' }}
            onPress={() => onChange(id)}
            cursor="pointer"
            userSelect="none"
          >
            <Image
              width={iconSize}
              height={iconSize}
              borderRadius="$full"
              source={{ uri: network.logoURI }}
            />
          </Stack>
        );
        // Icons alone are hard to tell apart; a pointer gets the name
        return large ? (
          chip
        ) : (
          <Tooltip
            key={id}
            renderTrigger={chip}
            renderContent={network.name}
            placement="bottom"
          />
        );
      })}
      <MoreButton
        networks={listNetworks}
        selectedNetworkId={value ?? allNetworkId}
        onNetworkSelect={handleListSelect}
        customTrigger={moreTrigger}
        placement="bottom-end"
      />
    </XStack>
  );
}
