import type { ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import type { IButtonProps, IXStackProps } from '@onekeyhq/components';
import {
  useHomeMoneroEnableRequestAtom,
  useHomePrivacyTokenStatusAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { withPrivacyChainPoolProvider } from '@onekeyhq/kit/src/states/jotai/contexts/privacyChainPool';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { IMPL_XMR } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { LocalWalletPoolStatus } from '../../AssetDetails/pages/TokenDetails/LocalWalletPoolStatus';
import {
  resolveSelectedPoolId,
  useLocalWalletPool,
} from '../../AssetDetails/pages/TokenDetails/useLocalWalletPool';
import { HomeTestIDs } from '../testIDs';

import { RawActions } from './WalletActions/RawActions';
import { WalletActionMore } from './WalletActions/WalletActionMore';

import type { ILocalWalletPool } from '../../AssetDetails/pages/TokenDetails/useLocalWalletPool';

export type IHomePrivacyActionsPresentation = {
  ownerKey: string;
  variant: 'privacy-loading' | 'privacy-enable' | 'standard';
};

type IHomePrivacyActionsPresentationProps = {
  onPresentationChange?: (
    presentation: IHomePrivacyActionsPresentation,
  ) => void;
};

function HomeMoneroEnableButton({
  requestEnable,
  onRequestHandled,
  onPress,
  ...props
}: IButtonProps & {
  requestEnable: boolean;
  onRequestHandled: () => void;
  onPress: () => Promise<void>;
}) {
  const handledRef = useRef(false);
  useEffect(() => {
    if (!requestEnable) {
      handledRef.current = false;
      return;
    }
    if (props.disabled || handledRef.current) return;
    handledRef.current = true;
    onRequestHandled();
    // Continue the user's Enable click after address creation using the same form and guards.
    void onPress().catch((error: unknown) => {
      console.error('[privacyChain] enable setup failed', {
        error: error instanceof Error ? error.message : '',
      });
    });
  }, [onPress, onRequestHandled, props.disabled, requestEnable]);
  return <Button {...props} testID={props.testID} onPress={onPress} />;
}

type IHomeMoneroActionsProps = {
  account: INetworkAccount;
  networkId: string;
  vaultSettings: IVaultSettings | undefined;
  children: ReactNode;
} & IXStackProps &
  IHomePrivacyActionsPresentationProps;

function usePublishHomePrivacyTokenStatus({
  accountId,
  networkId,
  pool,
}: {
  accountId: string;
  networkId: string;
  pool: ILocalWalletPool;
}) {
  const [, setHomePrivacyTokenStatus] = useHomePrivacyTokenStatusAtom();
  const tokenSyncStatus =
    pool.isReady &&
    pool.isWalletSupported === true &&
    !pool.isTempWallet &&
    !pool.state?.privacyDisabled
      ? pool.syncStatus
      : undefined;
  useLayoutEffect(() => {
    setHomePrivacyTokenStatus((previous) => {
      if (tokenSyncStatus === undefined) {
        return previous?.accountId === accountId &&
          previous.networkId === networkId
          ? undefined
          : previous;
      }
      if (
        previous?.accountId === accountId &&
        previous.networkId === networkId &&
        previous.status === tokenSyncStatus
      ) {
        return previous;
      }
      return { accountId, networkId, status: tokenSyncStatus };
    });
  }, [accountId, networkId, setHomePrivacyTokenStatus, tokenSyncStatus]);
  useLayoutEffect(
    () => () => {
      // An old account must not clear the next account's published status.
      setHomePrivacyTokenStatus((previous) =>
        previous?.accountId === accountId && previous.networkId === networkId
          ? undefined
          : previous,
      );
    },
    [accountId, networkId, setHomePrivacyTokenStatus],
  );
}

function getHomeMoneroActionsVariant(
  pool: ILocalWalletPool,
): IHomePrivacyActionsPresentation['variant'] {
  if (!pool.isReady) return 'privacy-loading';
  if (
    (pool.enabled && !pool.isSyncPaused) ||
    !pool.hasPooledBalance ||
    pool.state?.privacyDisabled ||
    pool.isUnsupportedWallet ||
    pool.isTempWallet
  ) {
    return 'standard';
  }
  return 'privacy-enable';
}

function useHomeMoneroEnableRequest({
  accountId,
  networkId,
  variant,
}: {
  accountId: string;
  networkId: string;
  variant: IHomePrivacyActionsPresentation['variant'];
}) {
  const [enableRequest, setEnableRequest] = useHomeMoneroEnableRequestAtom();
  const requestEnable =
    enableRequest?.accountId === accountId &&
    enableRequest.networkId === networkId;
  const handleEnableRequest = useCallback(() => {
    setEnableRequest((previous) =>
      previous === enableRequest ? undefined : previous,
    );
  }, [enableRequest, setEnableRequest]);
  useEffect(() => {
    if (requestEnable && variant === 'standard') handleEnableRequest();
  }, [handleEnableRequest, requestEnable, variant]);
  return { requestEnable, handleEnableRequest };
}

function HomeMoneroEnableActions({
  accountId,
  networkId,
  pool,
  requestEnable,
  handleEnableRequest,
  ...rest
}: IXStackProps & {
  accountId: string;
  networkId: string;
  pool: ILocalWalletPool;
  requestEnable: boolean;
  handleEnableRequest: () => void;
}) {
  const intl = useIntl();
  return (
    <LocalWalletPoolStatus
      networkId={networkId}
      accountId={accountId}
      pool={pool}
      presentation="home"
      renderEnableTrigger={({ onPress, loading, disabled }) => (
        <YStack {...rest} gap="$3">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.monero_enable_home__desc,
            })}
          </SizableText>
          <RawActions justifyContent="flex-start" gap="$2.5">
            <HomeMoneroEnableButton
              requestEnable={requestEnable}
              onRequestHandled={handleEnableRequest}
              testID={HomeTestIDs.enableMoneroButton}
              flex={1}
              size="large"
              variant="primary"
              loading={loading}
              disabled={disabled}
              onPress={onPress}
              $gtSm={{ flex: 0, alignSelf: 'flex-start', minWidth: 200 }}
            >
              {intl.formatMessage({ id: ETranslations.global_enable })}
            </HomeMoneroEnableButton>
            <WalletActionMore iconOnly />
          </RawActions>
        </YStack>
      )}
    />
  );
}

function useHomeMoneroPool({
  account,
  networkId,
  vaultSettings,
}: Pick<IHomeMoneroActionsProps, 'account' | 'networkId' | 'vaultSettings'>) {
  const isFocused = useIsFocused();
  const accountData = useMemo(
    () => ({ account, vaultSettings }),
    [account, vaultSettings],
  );
  const pool = useLocalWalletPool({
    networkId,
    accountId: account.id,
    accountData,
    isActive: isFocused,
    poolId: resolveSelectedPoolId({
      settings: vaultSettings?.localWallet,
      selectedPoolId: undefined,
    }),
  });
  return { pool, isFocused };
}

function HomeMoneroActions({
  account,
  networkId,
  vaultSettings,
  children,
  onPresentationChange,
  ...rest
}: IHomeMoneroActionsProps) {
  const { pool, isFocused } = useHomeMoneroPool({
    account,
    networkId,
    vaultSettings,
  });
  const variant = getHomeMoneroActionsVariant(pool);
  const owner = { accountId: account.id, networkId };
  usePublishHomePrivacyTokenStatus({ ...owner, pool });
  const { requestEnable, handleEnableRequest } = useHomeMoneroEnableRequest({
    ...owner,
    variant,
  });
  useLayoutEffect(() => {
    onPresentationChange?.({ ownerKey: `${networkId}:${account.id}`, variant });
  }, [account.id, networkId, onPresentationChange, variant]);
  if (variant === 'privacy-loading') {
    return (
      <RawActions.Placeholder
        {...rest}
        testID={HomeTestIDs.walletActionsLoading}
      />
    );
  }
  if (variant === 'standard') return <>{children}</>;
  return (
    <HomeMoneroEnableActions
      {...rest}
      {...owner}
      pool={pool}
      requestEnable={isFocused && requestEnable && !pool.enabled}
      handleEnableRequest={handleEnableRequest}
    />
  );
}

const HomeMoneroActionsScoped = withPrivacyChainPoolProvider(HomeMoneroActions);

export function HomePrivacyActions({
  children,
  onPresentationChange,
  ...rest
}: { children: ReactNode } & IXStackProps &
  IHomePrivacyActionsPresentationProps) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, network, vaultSettings, ready, isNetworkNotMatched } =
    activeAccount;
  const isMonero =
    !!network?.id &&
    !network.isAllNetworks &&
    networkUtils.getNetworkImpl({ networkId: network.id }) === IMPL_XMR;
  const isAccountReady = ready && !isNetworkNotMatched && !!account?.id;
  useLayoutEffect(() => {
    if (!isMonero || !isAccountReady) {
      onPresentationChange?.({
        ownerKey: `${network?.id ?? ''}:${account?.id ?? ''}`,
        variant: isMonero ? 'privacy-loading' : 'standard',
      });
    }
  }, [
    account?.id,
    isAccountReady,
    isMonero,
    network?.id,
    onPresentationChange,
  ]);
  if (!isMonero || !network?.id) {
    return <>{children}</>;
  }

  if (!ready || isNetworkNotMatched || !account?.id) {
    return (
      <RawActions.Placeholder
        {...rest}
        testID={HomeTestIDs.walletActionsLoading}
      />
    );
  }

  // Remounting closes any enable dialog owned by the previous account.
  return (
    <HomeMoneroActionsScoped
      {...rest}
      key={`${network.id}:${account.id}`}
      networkId={network.id}
      account={account}
      vaultSettings={vaultSettings}
      onPresentationChange={onPresentationChange}
    >
      {children}
    </HomeMoneroActionsScoped>
  );
}
