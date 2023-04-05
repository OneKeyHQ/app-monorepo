import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import type { ImportableHDAccount } from '@onekeyhq/engine/src/types/account';
import { HardwareSDK } from '@onekeyhq/shared/src/device/hardwareInstance';
import { INDEX_PLACEHOLDER } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { deviceUtils } from '../../../utils/hardware';
import { wait } from '../../../utils/helper';

import type { IFetchAddressByRange, IFetchAddressByWallet } from '.';

const FROM_INDEX_MAX = 2 ** 31;

export function useFetchSetRangeAddress({
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
  useEffect(() => {
    console.log('useFetchSetRangeAddress render render =====>>>>>');
  }, []);
  const intl = useIntl();
  const isHwWallet = walletId.startsWith('hw');
  const isSetRangeMode = data.type === 'setRange';
  const cancelFlagRef = useRef(false);
  const [progress, setProgress] = useState<number>(0);
  const [generatedAccounts, setGeneratedAccounts] = useState<
    ImportableHDAccount[]
  >([]);
  const temporaryAccountsRef = useRef<ImportableHDAccount[]>([]);
  const checkAddressPathRef = useRef<{ address?: string; path: string }[]>([]);
  const [previousAddress, setPreviousAddress] = useState('');

  const updateSetRangeAccountProgress = useCallback(
    (result: any[], forceFinish?: boolean) => {
      if (data.type !== 'setRange') return;
      const { generateCount } = data;
      const value = forceFinish
        ? 1
        : Math.floor((result.length / Number(generateCount)) * 100) / 100;
      setGeneratedAccounts(result);
      setProgress(value);
    },
    [data],
  );

  const isSubscribeRef = useRef(false);
  useEffect(() => {
    if (!isHwWallet || isSubscribeRef.current) return;
    isSubscribeRef.current = true;
    HardwareSDK.on('UI_EVENT', (e) => {
      const { type, payload } = e;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const payloadData = payload.data as unknown as {
        address: string;
        path: string;
      };
      if (type !== 'ui-previous_address_result') {
        return;
      }
      if (!isSetRangeMode) {
        return;
      }
      const pathIndex = checkAddressPathRef.current.findIndex(
        (i) => i.path === payloadData.path,
      );
      if (pathIndex < 0) {
        return;
      }
      setPreviousAddress(payloadData.address ?? '');
      backgroundApiProxy.serviceDerivationPath
        .convertPlainAddressItemToImportableHDAccount({
          networkId,
          ...payloadData,
        })
        .then((account) => {
          temporaryAccountsRef.current.push(account);
          updateSetRangeAccountProgress(temporaryAccountsRef.current);
        });
    });
  }, [isHwWallet, isSetRangeMode, networkId, updateSetRangeAccountProgress]);

  const generateHDAccounts = useCallback(
    async ({
      start,
      offset,
      purpose,
      template,
    }: {
      start: number;
      offset: number;
      purpose?: number;
      template?: string;
    }) => {
      const accounts = await backgroundApiProxy.engine.searchHDAccounts(
        walletId,
        networkId,
        password,
        start,
        offset,
        purpose,
        template,
      );
      return accounts;
    },
    [networkId, password, walletId],
  );

  // HD Wallet, fetch address for set range mode
  useEffect(() => {
    if (!isSetRangeMode) return;
    if (isHwWallet) return;
    (async () => {
      if (platformEnv.isNative) {
        await wait(200);
      }
      const { fromIndex, generateCount, derivationOption } = data;
      const template = derivationOption?.template;
      const purpose = parseInt(
        derivationOption?.category?.split("'/")?.[0] ?? '44',
      );

      const startIndex = Number(fromIndex) - 1;
      let start = startIndex;
      const pageSize = 5;
      let finalLimit = Number(generateCount);
      if (start + finalLimit > FROM_INDEX_MAX) {
        finalLimit = FROM_INDEX_MAX - start;
      }

      const result: ImportableHDAccount[] = [];
      let totalGenerateCount = 0;
      while (start < startIndex + finalLimit) {
        let offset = pageSize;
        if (start + pageSize > startIndex + finalLimit) {
          offset = finalLimit - totalGenerateCount;
        }
        if (offset <= 0) {
          break;
        }
        if (cancelFlagRef.current) {
          break;
        }
        const accountsWithNormalizeAddress = await generateHDAccounts({
          start,
          offset,
          purpose,
          template,
        });
        const accounts = await Promise.all(
          accountsWithNormalizeAddress.map(async (account) => ({
            ...account,
            displayAddress: await backgroundApiProxy.engine.getDisplayAddress(
              networkId,
              account.displayAddress,
            ),
          })),
        );
        result.push(...accounts);
        start += pageSize;
        totalGenerateCount += offset;
        if (platformEnv.isNative) {
          await wait(100);
        }
        if (accounts.length !== offset) {
          updateSetRangeAccountProgress(result, true);
          break;
        }
        updateSetRangeAccountProgress(result);
      }
    })();
  }, [
    data,
    isHwWallet,
    isSetRangeMode,
    networkId,
    password,
    walletId,
    generateHDAccounts,
    updateSetRangeAccountProgress,
  ]);

  // Fetch Hardware Address
  useEffect(() => {
    if (!isSetRangeMode) return;
    if (!isHwWallet) return;
    (async () => {
      const { fromIndex, generateCount, derivationOption } = data;
      const template = derivationOption?.template;
      if (!template) throw new Error('must be a template');
      const indexes = [];
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < Number(generateCount || 0); i++) {
        const index = Number(fromIndex) - 1 + i;
        indexes.push(index);
      }
      checkAddressPathRef.current = indexes.map((i) => ({
        path: template.replace(INDEX_PLACEHOLDER, i.toString()),
      }));
      try {
        const addressInfos =
          await backgroundApiProxy.serviceDerivationPath.batchGetHWAddress({
            networkId,
            walletId,
            indexes,
            template,
            confirmOnDevice: true,
          });
        updateSetRangeAccountProgress(addressInfos);
      } catch (e: any) {
        debugLogger.common.info('getHWAddressByTemplate error: ', e);
        const { className } = e || {};
        if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
          deviceUtils.showErrorToast(e);
        } else {
          ToastManager.show({
            title: intl.formatMessage(
              {
                id: 'msg__cancelled_during_the_process',
              },
              { type: 'error' },
            ),
          });
        }
        updateSetRangeAccountProgress(temporaryAccountsRef.current, true);
      }
    })();
  }, [
    data,
    isHwWallet,
    isSetRangeMode,
    networkId,
    walletId,
    updateSetRangeAccountProgress,
    intl,
  ]);

  const progressText = useMemo(() => {
    if (!isSetRangeMode) return undefined;
    const total = data.generateCount || '0';
    return `${
      Number.isSafeInteger(generatedAccounts.length)
        ? generatedAccounts.length
        : 0
    }/${total}`;
  }, [data, isSetRangeMode, generatedAccounts.length]);

  return {
    progress,
    progressText,
    generatedAccounts,
    previousAddress,
  };
}
