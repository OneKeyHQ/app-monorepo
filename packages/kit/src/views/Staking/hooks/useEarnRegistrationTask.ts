import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { createEarnRegistrationTask } from '@onekeyhq/kit/src/views/Earn/tasks/earnRegistrationTask';
import { createEarnTaskReservationRegistry } from '@onekeyhq/kit/src/views/Earn/tasks/earnTaskReservationRegistry';
import {
  isTaskAccountAddress,
  normalizeTaskAccountAddress,
} from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { autoFixPersonalSignMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { IEarnVerifyRegisterSignMessageResponse } from '@onekeyhq/shared/types/staking';

import { useCommittedEarnScopeGuard } from './useCommittedEarnScopeGuard';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

type IRegistrationScope = {
  accountId?: string;
  networkId?: string;
  accountAddress?: string;
  provider?: string;
  symbol?: string;
  ownerKey?: string;
};

type IRegistrationOperation =
  | { mode: 'signed'; request: IJsBridgeMessagePayload }
  | { mode: 'activation'; signal?: AbortSignal };

type IRegistrationTask = ReturnType<
  typeof createEarnRegistrationTask<IEarnVerifyRegisterSignMessageResponse>
>;

const registrationTasks = createEarnTaskReservationRegistry<
  string,
  IRegistrationTask
>();

export function useEarnRegistrationTask({
  accountId,
  networkId,
  accountAddress,
  provider,
  symbol,
  ownerKey,
}: IRegistrationScope) {
  const intl = useIntl();
  const scopeKey = JSON.stringify([
    accountId,
    networkId,
    accountAddress,
    provider,
    symbol,
    ownerKey,
  ]);
  const scope = useCommittedEarnScopeGuard(scopeKey);
  const ownedTasks = useRef(new Set<IRegistrationTask>());
  useEffect(() => {
    const tasks = ownedTasks.current;
    return () => {
      tasks.forEach((task) => task.cancel());
      tasks.clear();
    };
  }, [scopeKey]);

  return useCallback(
    async (operation: IRegistrationOperation) => {
      if (!accountId || !networkId || !provider || !symbol)
        throw new OneKeyLocalError('Earn registration account is required');
      const scopeCurrent = scope.capture();
      const abortSignal =
        operation.mode === 'activation' ? operation.signal : undefined;
      const isCurrent = () => scopeCurrent() && !abortSignal?.aborted;
      if (!isCurrent()) return undefined;
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      if (!isCurrent()) return undefined;
      const identity = {
        accountId,
        networkId,
        accountAddress: account.address,
        provider,
        action: 'register' as const,
        intent: { symbol, mode: operation.mode },
      };
      if (
        !account.address ||
        (accountAddress && !isTaskAccountAddress(identity, accountAddress))
      )
        throw new OneKeyLocalError('Earn registration account changed');

      const ensureAccount = async () => {
        const latest = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        if (!isCurrent() || !isTaskAccountAddress(identity, latest.address))
          throw new OneKeyLocalError('Earn registration account changed');
      };
      const task =
        createEarnRegistrationTask<IEarnVerifyRegisterSignMessageResponse>({
          identity,
          isCurrent,
          ensureAccount,
          ...(operation.mode === 'signed'
            ? {
                sign: async (signal: AbortSignal) => {
                  const unsigned =
                    await backgroundApiProxy.serviceStaking.buildRegisterSignMessageData(
                      {
                        networkId,
                        provider,
                        symbol,
                        accountAddress: account.address,
                      },
                    );
                  if (signal.aborted || !isCurrent())
                    throw new OneKeyLocalError('Earn registration expired');
                  await ensureAccount();
                  if (signal.aborted || !isCurrent())
                    throw new OneKeyLocalError('Earn registration expired');
                  const message = `0x${Buffer.from(
                    autoFixPersonalSignMessage({ message: unsigned.message }),
                    'utf8',
                  ).toString('hex')}`;
                  const signature =
                    await backgroundApiProxy.serviceDApp.openSignMessageModal({
                      accountId,
                      networkId,
                      request: operation.request,
                      unsignedMessage: {
                        type: EMessageTypesEth.PERSONAL_SIGN,
                        message,
                        payload: [message, account.address],
                      },
                      walletInternalSign: true,
                    });
                  if (typeof signature !== 'string' || !signature)
                    throw new OneKeyLocalError(
                      'Registration signature is missing',
                    );
                  return { message: unsigned.message, signature };
                },
              }
            : {}),
          verify: (signed) =>
            backgroundApiProxy.serviceStaking.verifyRegisterSignMessage({
              networkId,
              provider,
              symbol,
              accountAddress: account.address,
              signature: signed?.signature ?? '',
              message: signed?.message ?? '',
            }),
        });
      const key = JSON.stringify([
        networkId,
        normalizeTaskAccountAddress(networkId, account.address),
        provider.toLowerCase(),
      ]);
      const token = registrationTasks.reserve(key, task);
      if (!token) {
        Toast.message({
          title: intl.formatMessage({ id: ETranslations.global_pending }),
        });
        throw new OneKeyLocalError('Earn registration already in progress');
      }
      ownedTasks.current.add(task);
      const cancelTask = () => task.cancel();
      abortSignal?.addEventListener('abort', cancelTask, { once: true });
      try {
        if (!isCurrent()) cancelTask();
        return await task.runRegistration();
      } finally {
        abortSignal?.removeEventListener('abort', cancelTask);
        ownedTasks.current.delete(task);
        registrationTasks.release(key, token);
      }
    },
    [accountAddress, accountId, intl, networkId, provider, scope, symbol],
  );
}
