import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import { getDefaultAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import type { Account } from '@onekeyhq/engine/src/types/account';
import {
  IMPL_COSMOS,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { deviceUtils } from '../../../utils/hardware';
import { wait } from '../../../utils/helper';

import type { IFetchAddressByRange, IFetchAddressByWallet } from '.';
import type { IWalletAccounts } from './FetchAddressModal';

function getAccountIndex(template: string, path: string) {
  const templateParts = template.split(INDEX_PLACEHOLDER).filter(Boolean);
  let currentPath = path;
  for (const part of templateParts) {
    currentPath = currentPath.split(part).filter(Boolean)?.[0];
  }
  return currentPath.endsWith(`'`) ? currentPath.slice(0, -1) : currentPath;
}

export function useFetchWalletAddress({
  data,
  walletId,
  networkId,
  password,
}: {
  data: IFetchAddressByRange | IFetchAddressByWallet;
  walletId: string;
  networkId: string;
  password: string;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isHwWallet = walletId.startsWith('hw');
  const isFetchWalletAccountsMode = data.type === 'walletAccounts';
  const cancelFlagRef = useRef(false);
  const [progress, setProgress] = useState<number>(0);
  const [walletAccounts, setWalletAccounts] = useState<IWalletAccounts[]>([]);
  const temporaryAccountsRef = useRef<IWalletAccounts[]>([]);
  const currentTemplateRef = useRef('');

  const [previousAddress, setPreviousAddress] = useState('');
  const previousAddressPayload = useAppSelector(
    (s) => s.hardware.previousAddress,
  );

  const updateWalletsAccountProgress = useCallback(
    (result: IWalletAccounts[], forceFinish?: boolean) => {
      if (data.type !== 'walletAccounts') return;
      const { networkDerivations } = data;
      const totalLength = networkDerivations.reduce(
        (acc, cur) => acc + cur.accounts.length,
        0,
      );
      const finishLength = result.reduce((acc, cur) => {
        const accountDataLength = isHwWallet
          ? cur.accountData.filter((i) => i.confirm).length
          : cur.accountData.length;
        return acc + accountDataLength;
      }, 0);
      const value = forceFinish
        ? 1
        : Math.floor((finishLength / Number(totalLength)) * 100) / 100;
      setWalletAccounts(result);
      setProgress(value);
    },
    [data, isHwWallet],
  );

  useEffect(() => {
    if (!isFetchWalletAccountsMode) return;
    const payloadData = previousAddressPayload?.data ?? {};
    if (!payloadData) return;
    const { path, address } = payloadData;
    if (!currentTemplateRef.current) return;
    temporaryAccountsRef.current.forEach((temporaryAccount) => {
      if (temporaryAccount.template !== currentTemplateRef.current) {
        return;
      }
      const { accountData } = temporaryAccount;
      const matchIndex = accountData.findIndex(
        (account) => account.fullPath === path,
      );
      if (matchIndex !== -1) {
        if (
          address &&
          accountData[matchIndex].address.toLowerCase() !==
            address.toLowerCase()
        ) {
          throw new Error('not same address');
        } else if (address) {
          backgroundApiProxy.serviceDerivationPath
            .convertPlainAddressItemToImportableHDAccount({
              networkId,
              path: path ?? '',
              address: address ?? '',
            })
            .then((account) => {
              accountData[matchIndex].address = account.displayAddress;
              accountData[matchIndex].confirm = true;
              setPreviousAddress(account.displayAddress ?? '');
              updateWalletsAccountProgress(temporaryAccountsRef.current);
            });
        }
      }
    });
  }, [
    previousAddressPayload,
    isFetchWalletAccountsMode,
    networkId,
    updateWalletsAccountProgress,
  ]);

  // Fetch HD Wallet Accounts
  useEffect(() => {
    if (!isFetchWalletAccountsMode) return;
    if (isHwWallet) return;

    (async () => {
      if (platformEnv.isNative) {
        await wait(200);
      }
      let errorState = false;
      const { networkDerivations } = data;
      const result: IWalletAccounts[] = [];
      const { impl } = await backgroundApiProxy.engine.getNetwork(networkId);
      for (const networkDerivation of networkDerivations) {
        const accounts = await backgroundApiProxy.engine.getAccounts(
          networkDerivation.accounts,
          networkId,
        );
        const accountData = [];
        for (const account of accounts) {
          try {
            if (cancelFlagRef.current || errorState) {
              break;
            }
            let { template } = account;
            if (!template || impl === IMPL_COSMOS) {
              template = getDefaultAccountNameInfoByImpl(impl).template;
            }
            const pathComponent = account.path.split('/');
            const purpose = Number(
              pathComponent[1].endsWith(`'`)
                ? pathComponent[1].slice(0, -1)
                : pathComponent[1],
            );
            const pathComponentAccountIndex = template
              ?.split('/')
              .findIndex((x: string) => x.startsWith(INDEX_PLACEHOLDER));
            if (
              !Number.isSafeInteger(pathComponentAccountIndex) ||
              Number(pathComponentAccountIndex) < 0
            ) {
              debugLogger.common.error('can not find account index: ', account);
              throw new Error('can not find account index');
            }
            const accountIndex = pathComponent[
              pathComponentAccountIndex ?? 0
            ].replace(/'$/, '');
            const hdAccount =
              await backgroundApiProxy.engine.getAccountsByVault({
                walletId,
                networkId,
                password,
                indexes: [parseInt(accountIndex, 10)],
                purpose,
                template,
              });
            if (
              hdAccount.length === 1 &&
              account.address !== hdAccount?.[0].displayAddress
            ) {
              account.address = hdAccount[0].displayAddress;
            }
            const address = await backgroundApiProxy.engine.getDisplayAddress(
              networkId,
              account.address,
            );
            accountData.push({
              ...account,
              address,
              index: getAccountIndex(networkDerivation.template, account.path),
            });

            const sortedAccountData = accountData.sort(
              (a, b) => Number(a.index) - Number(b.index),
            );
            // replace or insert result data
            const derivationIndex = result.findIndex(
              (i) => i.template === networkDerivation.template,
            );
            if (derivationIndex > -1) {
              result.splice(derivationIndex, 1, {
                ...networkDerivation,
                accountData: sortedAccountData as unknown as (Account & {
                  index: number;
                })[],
              });
            } else {
              result.push({
                ...networkDerivation,
                accountData: sortedAccountData as unknown as (Account & {
                  index: number;
                })[],
              });
            }
            updateWalletsAccountProgress(result);
            if (platformEnv.isNative) {
              await wait(0);
            }
          } catch (e: any) {
            debugLogger.common.info('Fetch Wallet Accounts error: ', e);
            const { className } = e || {};
            if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
              deviceUtils.showErrorToast(e);
            } else {
              ToastManager.show(
                {
                  title: intl.formatMessage({
                    id: 'msg__cancelled_during_the_process',
                  }),
                },
                { type: 'error' },
              );
            }
            updateWalletsAccountProgress(result, true);
            errorState = true;
            navigation.goBack();
            break;
          }
        }
      }
    })();
  }, [
    data,
    isHwWallet,
    isFetchWalletAccountsMode,
    updateWalletsAccountProgress,
    networkId,
    walletId,
    intl,
    password,
    navigation,
  ]);

  // Fetch Hardware Wallet Accounts
  useEffect(() => {
    if (!isFetchWalletAccountsMode) return;
    if (!isHwWallet) return;

    (async () => {
      if (platformEnv.isNative) {
        await wait(200);
      }
      let errorState = false;
      const { networkDerivations } = data;
      const result: IWalletAccounts[] = [];
      for (const networkDerivation of networkDerivations) {
        try {
          const accounts = await backgroundApiProxy.engine.getAccounts(
            networkDerivation.accounts,
            networkId,
          );
          const accountData = accounts
            .map((account) => {
              const index = getAccountIndex(
                networkDerivation.template,
                account.path,
              );
              return {
                fullPath: networkDerivation.template.replace(
                  INDEX_PLACEHOLDER,
                  index.toString(),
                ),
                index: Number(index),
                ...account,
              };
            })
            .sort((a, b) => Number(a.index) - Number(b.index));

          currentTemplateRef.current = networkDerivation.template;
          temporaryAccountsRef.current.push({
            ...networkDerivation,
            accountData: accountData.map((i) => ({ ...i, confirm: false })),
          });

          const hardwareAddressesResults =
            await backgroundApiProxy.serviceDerivationPath.batchGetHWAddress({
              networkId,
              walletId,
              indexes: accountData.map((i) => Number(i.index)),
              confirmOnDevice: true,
              template: networkDerivation.template,
            });
          hardwareAddressesResults.forEach((res) => {
            const index = accountData.findIndex((i) => i.fullPath === res.path);
            if (index > -1) {
              accountData[index].displayAddress = res.displayAddress;
            }
          });
          result.push({
            ...networkDerivation,
            accountData,
          });
          if (cancelFlagRef.current || errorState) {
            break;
          }
          if (platformEnv.isNative) {
            await wait(0);
          }
        } catch (e: any) {
          debugLogger.common.info('Fetch Wallet Accounts error: ', e);
          const { className } = e || {};
          if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
            deviceUtils.showErrorToast(e);
          } else {
            ToastManager.show(
              {
                title: intl.formatMessage({
                  id: 'msg__cancelled_during_the_process',
                }),
              },
              { type: 'error' },
            );
          }
          updateWalletsAccountProgress(result, true);
          errorState = true;
          navigation.goBack();
          break;
        }
      }
    })();
  }, [
    data,
    isHwWallet,
    isFetchWalletAccountsMode,
    updateWalletsAccountProgress,
    networkId,
    walletId,
    intl,
    password,
    navigation,
  ]);

  const progressText = useMemo(() => {
    if (!isFetchWalletAccountsMode) return undefined;
    const total = data.networkDerivations.reduce(
      (acc, cur) => acc + cur.accounts.length,
      0,
    );
    const dataSource = isHwWallet
      ? temporaryAccountsRef.current
      : walletAccounts;
    const finish = dataSource.reduce((acc, cur) => {
      const accountDataLength = isHwWallet
        ? cur.accountData.filter((i) => i.confirm).length
        : cur.accountData.length;
      return acc + accountDataLength;
    }, 0);
    return `${finish}/${total}`;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isHwWallet, isFetchWalletAccountsMode, walletAccounts, progress]);

  return {
    progress,
    progressText,
    previousAddress,
    walletAccounts,
    cancelFlagRef,
  };
}
