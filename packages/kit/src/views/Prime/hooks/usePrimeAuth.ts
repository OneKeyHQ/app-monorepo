import { useCallback, useMemo } from 'react';

import { Toast } from '@onekeyhq/components';
import {
  usePrimeInitAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { usePrivyUniversal } from './usePrivyUniversal';

export function usePrimeAuth() {
  const [primePersistAtom, setPrimePersistAtom] = usePrimePersistAtom();
  const [primeInitAtom, setPrimeInitAtom] = usePrimeInitAtom();

  const privy = usePrivyUniversal();
  const { logout, isReady, getAccessToken } = privy;

  const login = useCallback(() => {
    if (platformEnv.isNative) {
      privy.native?.login?.({
        loginMethods: ['email'],
      });
    } else {
      privy.web?.login?.({
        loginMethods: ['email'],
      });
    }
  }, [privy]);

  const loginLegacy = useCallback(async () => {
    try {
      const email = await backgroundApiProxy.servicePrime.startPrimeLogin();
      console.log('prime email >>> ', email);
      Toast.success({
        title: `Prime login success: ${email.email}`,
      });
    } catch (error) {
      console.error(error);
      Toast.error({
        title: `login failed: ${(error as IOneKeyError)?.message || ''}`,
      });
    }
  }, []);

  const updateEmail = useCallback(() => {
    if (platformEnv.isNative) {
      throw new NotImplemented('updateEmail is not supported on native');
    } else {
      privy.web?.updateEmail?.();
    }
  }, [privy]);

  const updatePhone = useCallback(() => {
    if (platformEnv.isNative) {
      throw new NotImplemented('updatePhone is not supported on native');
    } else {
      privy.web?.updatePhone?.();
    }
  }, [privy]);

  return useMemo(
    () => ({
      // you should check isReady before use other methods
      // TODO when privy network is broken(isReady is false), we should show a Error Page on the Dashboard UI
      isReady: primeInitAtom.isReady,
      user: primePersistAtom,
      privy,
      login,
      loginLegacy,
      logout,
      updateEmail,
      updatePhone,
      getAccessToken,
    }),
    [
      getAccessToken,
      login,
      loginLegacy,
      logout,
      primeInitAtom,
      primePersistAtom,
      privy,
      updateEmail,
      updatePhone,
    ],
  );
}
