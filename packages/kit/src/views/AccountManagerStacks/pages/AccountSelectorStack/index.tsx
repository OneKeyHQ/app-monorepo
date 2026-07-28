import {
  Profiler,
  type ProfilerOnRenderCallback,
  useCallback,
  useEffect,
} from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, XStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';

import { useWebDappWalletSelector } from './useWebDappWalletSelector';
import { WalletDetails } from './WalletDetails';
import { AccountSelectorWalletListSideBar } from './WalletList';

export function AccountSelectorStack({
  num,
  hideNonBackedUpWallet,
}: {
  num: number;
  hideNonBackedUpWallet?: boolean;
}) {
  const { selectedAccount } = useSelectedAccount({ num });
  const { shouldHideWalletList } = useWebDappWalletSelector({
    num,
    focusedWallet: selectedAccount.focusedWallet,
  });
  const handleProfilerRender = useCallback<ProfilerOnRenderCallback>(
    (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      defaultLogger.accountSelector.switchPerf.functionTiming({
        functionName: `ReactProfiler.${id}`,
        durationMs: actualDuration,
        num,
        phase,
        baseDurationMs: baseDuration,
        startTimeMs: startTime,
        commitTimeMs: commitTime,
      });
    },
    [num],
  );

  return (
    <Page lazyLoad safeAreaEnabled={false}>
      <Page.Body>
        <XStack flex={1}>
          {/* <AccountSelectorWalletListSideBarPerfTest num={num} /> */}
          {shouldHideWalletList ? null : (
            <Profiler
              id="AccountSelectorWalletListSideBar"
              onRender={handleProfilerRender}
            >
              <AccountSelectorWalletListSideBar
                num={num}
                hideNonBackedUpWallet={hideNonBackedUpWallet}
              />
            </Profiler>
          )}

          {/* <WalletDetailsPerfTest num={num} /> */}
          <Profiler id="WalletDetails" onRender={handleProfilerRender}>
            <WalletDetails num={num} />
          </Profiler>
        </XStack>
      </Page.Body>
    </Page>
  );
}

export default function AccountSelectorStackPage({
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.AccountSelectorStack
>) {
  const { num, sceneName, sceneUrl, hideNonBackedUpWallet } = route.params;
  useEffect(() => {
    const mountedAt = Date.now();
    defaultLogger.accountSelector.switchPerf.lifecycle({
      stage: 'modalMounted',
      num,
    });
    return () => {
      defaultLogger.accountSelector.switchPerf.lifecycle({
        stage: 'modalUnmounted',
        num,
        elapsedMs: Date.now() - mountedAt,
      });
    };
  }, [num]);
  const handleProfilerRender = useCallback<ProfilerOnRenderCallback>(
    (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      defaultLogger.accountSelector.switchPerf.functionTiming({
        functionName: `ReactProfiler.${id}`,
        durationMs: actualDuration,
        num,
        phase,
        baseDurationMs: baseDuration,
        startTimeMs: startTime,
        commitTimeMs: commitTime,
      });
    },
    [num],
  );

  return (
    <AccountSelectorProviderMirror
      enabledNum={[num]}
      config={{
        sceneName,
        sceneUrl,
      }}
    >
      <Profiler id="AccountSelectorStack" onRender={handleProfilerRender}>
        <AccountSelectorStack
          num={num}
          hideNonBackedUpWallet={hideNonBackedUpWallet}
        />
      </Profiler>
    </AccountSelectorProviderMirror>
  );
}
