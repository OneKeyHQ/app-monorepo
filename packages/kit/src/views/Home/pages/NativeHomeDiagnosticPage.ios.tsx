import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { StyleSheet, useColorScheme } from 'react-native';

import { getTokenListOwnerCacheAccountId } from '@onekeyhq/kit/src/components/TokenListView/utils';
import {
  HomeContainer,
  type INativeHomeDiagnosticIntent,
  type INativeHomeOwnerToken,
  type INativeHomeViewModel,
} from '@onekeyhq/native-components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

function useNativeHomeOwnerToken(
  sceneName: EAccountSelectorSceneName,
): INativeHomeOwnerToken {
  const instanceId = useId();
  const sessionOrdinalRef = useRef(0);
  const sessionRef = useRef({ scopeKey: '', sessionId: '' });
  const {
    activeAccount: {
      account,
      indexedAccount,
      network,
      wallet,
      deriveInfoItems,
      vaultSettings,
    },
  } = useActiveAccount({ num: 0 });

  const mergeDeriveAddressData =
    vaultSettings?.mergeDeriveAssetsEnabled &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1;
  const effectiveTokenOwnerId = getTokenListOwnerCacheAccountId({
    accountId: account?.id,
    indexedAccountId: indexedAccount?.id,
    mergeDeriveAddressData: !!mergeDeriveAddressData,
  });
  const scopeKey = [
    sceneName,
    wallet?.id ?? '',
    account?.id ?? '',
    effectiveTokenOwnerId ?? '',
    network?.id ?? '',
  ].join('|');

  if (sessionRef.current.scopeKey !== scopeKey) {
    sessionOrdinalRef.current += 1;
    sessionRef.current = {
      scopeKey,
      sessionId: `${instanceId}:${sessionOrdinalRef.current}`,
    };
  }

  return sessionRef.current;
}

export function NativeHomeDiagnosticPage({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const colorScheme = useColorScheme();
  const owner = useNativeHomeOwnerToken(sceneName);
  const [roundTrip, setRoundTrip] = useState({ sessionId: '', count: 0 });
  const viewModelRef = useRef<INativeHomeViewModel | null>(null);
  const verifiedCount =
    roundTrip.sessionId === owner.sessionId ? roundTrip.count : 0;

  const state = useMemo<INativeHomeViewModel>(() => {
    const isDark = colorScheme === 'dark';
    return {
      protocolVersion: 1,
      owner,
      selectedTab: 'portfolio',
      header: {
        isDiagnostic: true,
        title: 'Native Wallet Home',
        subtitle:
          'Swift bridge mounted. Existing JavaScript remains the business authority.',
      },
      tabs: [
        {
          id: 'portfolio',
          title: 'Portfolio',
          enabled: true,
        },
      ],
      portfolio: {
        isDiagnostic: true,
        title: 'Portfolio diagnostic shell',
        message:
          verifiedCount > 0
            ? `Round trip verified ${verifiedCount} time${
                verifiedCount === 1 ? '' : 's'
              }. No business action was executed.`
            : 'No Header or Portfolio business data is rendered in Slice 1.',
      },
      theme: isDark
        ? {
            colorScheme: 'dark',
            backgroundColor: '#000000',
            surfaceColor: '#1C1C1E',
            primaryTextColor: '#FFFFFF',
            secondaryTextColor: '#8E8E93',
            accentColor: '#44D62C',
          }
        : {
            colorScheme: 'light',
            backgroundColor: '#FFFFFF',
            surfaceColor: '#F2F2F7',
            primaryTextColor: '#000000',
            secondaryTextColor: '#636366',
            accentColor: '#239B18',
          },
    };
  }, [colorScheme, owner, verifiedCount]);
  viewModelRef.current = state;

  const handleIntent = useCallback((intent: INativeHomeDiagnosticIntent) => {
    const currentViewModel = viewModelRef.current;
    if (
      !currentViewModel ||
      intent.owner.scopeKey !== currentViewModel.owner.scopeKey ||
      intent.owner.sessionId !== currentViewModel.owner.sessionId
    ) {
      return;
    }
    setRoundTrip((current) => ({
      sessionId: currentViewModel.owner.sessionId,
      count:
        current.sessionId === currentViewModel.owner.sessionId
          ? current.count + 1
          : 1,
    }));
  }, []);

  return (
    <HomeContainer
      style={styles.container}
      state={state}
      onIntent={handleIntent}
    />
  );
}
