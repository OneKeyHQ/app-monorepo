import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

type IEthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

// OneKey extension injects $onekey.ethereum as its dedicated provider.
// Avoids window.ethereum collisions when other wallets are also installed.
function getOneKeyExtensionProvider(): IEthereumProvider | null {
  const provider = (globalThis as Record<string, unknown>).$onekey as
    | { ethereum?: IEthereumProvider }
    | undefined;
  return provider?.ethereum ?? null;
}

export function useBindReferralViaExtension({
  referralCode,
  onSuccess,
}: {
  referralCode: string;
  onSuccess?: () => void;
}) {
  const intl = useIntl();
  const [isBinding, setIsBinding] = useState(false);
  // Synchronous in-flight guard. setIsBinding's effect isn't visible until the
  // next render, so rapid clicks before the first await can fire concurrent
  // eth_requestAccounts calls. The ref blocks the second entry immediately.
  const inFlightRef = useRef(false);

  const bindViaExtension = useCallback(async () => {
    if (!referralCode) return;
    if (inFlightRef.current) return;
    const provider = getOneKeyExtensionProvider();
    if (!provider) return;

    inFlightRef.current = true;
    setIsBinding(true);
    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];

      const address = accounts?.[0];
      if (!address) {
        throw new OneKeyLocalError('No account returned from extension');
      }

      const networkId = getNetworkIdsMap().eth;

      const message =
        await backgroundApiProxy.serviceReferralCode.getBoundReferralCodeUnsignedMessage(
          { address, networkId, inviteCode: referralCode },
        );

      const signature = (await provider.request({
        method: 'personal_sign',
        params: [message, address],
      })) as string;

      await backgroundApiProxy.serviceReferralCode.boundReferralCodeWithSignedMessage(
        { networkId, address, referralCode, signature },
      );

      await backgroundApiProxy.serviceReferralCode.setCachedInviteCode('');
      defaultLogger.referral.page.referralBindingCompleted({
        referralCode,
        address,
        networkId,
      });
      Toast.success({
        title: intl.formatMessage({ id: ETranslations.global_success }),
      });
      onSuccess?.();
    } catch {
      // - EIP-1193 4001 (user rejected): silent.
      // - Server API errors: auto-toasted by @backgroundMethod global handler;
      //   toasting here would cause a duplicate toast.
      // - Local errors (e.g. no account returned): rare; staying silent is
      //   acceptable since `isBinding` resets and the user can retry.
    } finally {
      // Always disconnect dApp session to clean up "connected to localhost"
      try {
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Ignore revocation errors
      }
      inFlightRef.current = false;
      setIsBinding(false);
    }
  }, [referralCode, intl, onSuccess]);

  return { bindViaExtension, isBinding };
}
