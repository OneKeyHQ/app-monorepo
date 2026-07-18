import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useUniversalBorrowSetEMode } from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { buildBorrowTag } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type {
  IBorrowEModeSwitchCheck,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';

export function useEModeSwitch({
  networkId,
  accountId,
  provider,
  marketAddress,
  onSwitched,
  getCategoryLabel,
}: {
  networkId: string;
  accountId: string;
  provider: string;
  marketAddress: string;
  onSwitched: () => void;
  // Resolves the category name for the success toast; the hook only knows the
  // eModeId, the label lives in the page's rows / route params.
  getCategoryLabel?: (eModeId: number) => string | undefined;
}) {
  const intl = useIntl();
  const mountedRef = useRef(true);
  const [targetEModeId, setTargetEModeId] = useState<number | null>(null);
  const [check, setCheck] = useState<IBorrowEModeSwitchCheck | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  // One in-flight tx at a time: guards the async build-tx window (before the
  // confirm modal opens) against a double-tap firing two builds / two modals.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Sequence id so an out-of-order (stale) switch-check response can never
  // overwrite the latest one; only the newest runCheck call applies state.
  const checkSeqRef = useRef(0);
  const setEMode = useUniversalBorrowSetEMode({ networkId, accountId });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      checkSeqRef.current += 1;
    };
  }, []);

  const stakingInfo = useCallback(
    (): IStakingInfo => ({
      label: EEarnLabels.Borrow,
      protocol: earnUtils.getEarnProviderName({ providerName: provider }),
      tags: [
        EEarnLabels.Borrow,
        buildBorrowTag({ provider, action: 'setEMode' }),
      ],
    }),
    [provider],
  );

  const runCheck = useCallback(
    async (eModeId: number) => {
      const seq = (checkSeqRef.current += 1);
      setTargetEModeId(eModeId);
      setCheck(null);
      setIsChecking(true);
      try {
        const resp =
          await backgroundApiProxy.serviceStaking.borrowSwitchCheckEMode({
            networkId,
            accountId,
            provider,
            marketAddress,
            targetEModeId: eModeId,
          });
        if (mountedRef.current && checkSeqRef.current === seq) {
          setCheck(resp.code === 0 ? resp.data : null);
        }
      } catch (error) {
        if (mountedRef.current && checkSeqRef.current === seq) {
          setCheck(null);
          Toast.error({
            title:
              error instanceof Error && error.message
                ? error.message
                : intl.formatMessage({ id: ETranslations.global_failed }),
          });
        }
      } finally {
        if (mountedRef.current && checkSeqRef.current === seq) {
          setIsChecking(false);
        }
      }
    },
    [networkId, accountId, provider, marketAddress, intl],
  );

  // Clear the selected target and its check. Bump the sequence so an in-flight
  // response cannot apply after the target becomes current or disappears.
  const resetTarget = useCallback(() => {
    checkSeqRef.current += 1;
    setTargetEModeId(null);
    setCheck(null);
    setIsChecking(false);
  }, []);

  const confirmSwitch = useCallback(async () => {
    if (targetEModeId === null || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await setEMode({
        provider,
        marketAddress,
        eModeId: targetEModeId,
        stakingInfo: stakingInfo(),
        onSuccess: () => {
          if (!mountedRef.current) {
            return;
          }
          Toast.success({
            title:
              targetEModeId === 0
                ? intl.formatMessage({
                    id: ETranslations.defi_emode_turned_off,
                  })
                : intl.formatMessage(
                    { id: ETranslations.defi_emode_switched_success },
                    { category: getCategoryLabel?.(targetEModeId) ?? '' },
                  ),
          });
          onSwitched();
        },
      });
    } catch {
      // ponytail: the API interceptor auto-toasts backend errors (autoToast on
      // code !== 0), so swallow here purely to clear the unhandled rejection
      // and release the lock. A rare non-server throw (e.g. network) goes
      // silent — acceptable; matches the sibling supply/borrow/repay flows.
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [
    targetEModeId,
    isSubmitting,
    setEMode,
    provider,
    marketAddress,
    stakingInfo,
    onSwitched,
    getCategoryLabel,
    intl,
  ]);

  return {
    targetEModeId,
    check,
    isChecking,
    isSubmitting,
    runCheck,
    resetTarget,
    confirmSwitch,
  };
}
