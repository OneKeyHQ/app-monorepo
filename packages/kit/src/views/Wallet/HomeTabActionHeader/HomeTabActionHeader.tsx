import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  IconButton,
  Spinner,
  Text,
  Typography,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatCurrencyNumber } from '../../../components/Format';
import { useAccountIsUpdating, useAppSelector } from '../../../hooks';
import { useHomeTabName } from '../../../hooks/useHomeTabName';
import { OverviewBadge } from '../../Overview/components/OverviewBadge';

import type BigNumber from 'bignumber.js';

const RefreshButton = memo(
  ({
    refreshing,
    onRefresh,
  }: {
    refreshing: boolean;
    onRefresh: () => void;
  }) => {
    const homeTabName = useAppSelector((s) => s.status.homeTabName);

    return (
      <Box alignItems="center" justifyContent="center" w="8" h="8" mr="3">
        {refreshing ? (
          <Spinner size="sm" key={homeTabName} />
        ) : (
          <IconButton
            onPress={onRefresh}
            size="sm"
            name="ArrowPathMini"
            type="plain"
            ml="auto"
          />
        )}
      </Box>
    );
  },
);
RefreshButton.displayName = 'RefreshButton';

// TODO remove
const OuterHeader = memo(
  ({
    onNavigate,
    onShowHomeBalanceSettings,
    tokenEnabled,
    networkId,
    accountId,
  }: {
    onNavigate: () => void;
    onShowHomeBalanceSettings: () => void;
    tokenEnabled: boolean;
    networkId: string;
    accountId: string;
  }) => {
    const intl = useIntl();

    const loading = useAccountIsUpdating({
      networkId,
      accountId,
    });

    const refresh = useCallback(() => {
      backgroundApiProxy.serviceOverview.refreshCurrentAccount({
        debounceEnabled: false,
      });
    }, []);

    return (
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        pb={3}
      >
        <Typography.Heading>
          {intl.formatMessage({ id: 'title__assets' })}
        </Typography.Heading>
        {tokenEnabled && (
          <HStack alignItems="center" justifyContent="flex-end">
            {isAllNetworks(networkId) ? null : (
              <RefreshButton refreshing={loading} onRefresh={refresh} />
            )}
            {isAllNetworks(networkId) ? null : (
              <IconButton
                onPress={onNavigate}
                size="sm"
                name="PlusMini"
                type="plain"
                ml="auto"
                mr={3}
              />
            )}
            <IconButton
              onPress={onShowHomeBalanceSettings}
              size="sm"
              name="Cog8ToothMini"
              type="plain"
              mr={-2}
            />
          </HStack>
        )}
      </Box>
    );
  },
);
OuterHeader.displayName = 'OuterHeader';

const TokenBalancesMemo = memo(
  ({ tokenAmount }: { tokenAmount: BigNumber }) => (
    <Text typography={{ sm: 'DisplayLarge', md: 'Heading' }}>
      {Number.isNaN(tokenAmount) || tokenAmount.isNaN() ? (
        ' '
      ) : (
        <FormatCurrencyNumber value={0} convertValue={tokenAmount} />
      )}
    </Text>
  ),
  (prevProps, nextProps) =>
    prevProps.tokenAmount.isEqualTo(nextProps.tokenAmount),
);
TokenBalancesMemo.displayName = 'TokenBalancesMemo';

const RateBadgeMemo = memo(
  ({ rate }: { rate: BigNumber }) => {
    if (rate.isNaN()) {
      return null;
    }

    return <OverviewBadge rate={rate} />;
  },
  (prevProps, nextProps) => prevProps.rate.isEqualTo(nextProps.rate),
);
RateBadgeMemo.displayName = 'RateBadgeMemo';

export type IHomeTabActionHeaderProps = {
  title: string;
  loading?: boolean;
  onClickRefresh?: () => void;
  onClickAdd?: () => void;
  onClickSettings?: () => void;
};
function HomeTabActionHeaderCmp({
  title,
  loading,
  onClickRefresh,
  onClickAdd,
  onClickSettings,
}: IHomeTabActionHeaderProps) {
  const currentHomeTabName = useHomeTabName();
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      pb={3}
    >
      <Typography.Heading>{title}</Typography.Heading>
      <HStack alignItems="center" justifyContent="flex-end">
        {onClickRefresh ? (
          <Box
            key={`${currentHomeTabName || ''}-${title}-refresh-box`}
            alignItems="center"
            justifyContent="center"
            w="8"
            h="8"
            mr="3"
          >
            {loading ? (
              <Spinner key={`${currentHomeTabName || ''}-spinner`} size="sm" />
            ) : (
              <IconButton
                key={`${currentHomeTabName || ''}-refresh`}
                onPress={onClickRefresh}
                size="sm"
                name="ArrowPathMini"
                type="plain"
                ml="auto"
              />
            )}
          </Box>
        ) : null}

        {onClickAdd ? (
          <IconButton
            onPress={onClickAdd}
            size="sm"
            name="PlusMini"
            type="plain"
            ml="auto"
            mr={3}
          />
        ) : null}

        {onClickSettings ? (
          <IconButton
            onPress={onClickSettings}
            size="sm"
            name="Cog8ToothMini"
            type="plain"
            mr={-2}
          />
        ) : null}
      </HStack>
    </Box>
  );
}
export const HomeTabActionHeader = memo(HomeTabActionHeaderCmp);
