import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Modal,
  Progress,
  Text,
  ToastManager,
  VStack,
} from '@onekeyhq/components';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import { getDefaultAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import type {
  Account,
  ImportableHDAccount,
} from '@onekeyhq/engine/src/types/account';
import ServiceDerivationPath from '@onekeyhq/kit-bg/src/services/ServiceDerivationPath';
import { HardwareSDK } from '@onekeyhq/shared/src/device/hardwareInstance';
import {
  IMPL_COSMOS,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { CreateAccountModalRoutes } from '../../../routes/routesEnum';
import { deviceUtils } from '../../../utils/hardware';
import { wait } from '../../../utils/helper';

import { formatDerivationLabel } from './helper';

import type { CreateAccountRoutesParams } from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { INetworkDerivationItem } from './WalletAccounts';
import type { RouteProp } from '@react-navigation/native';

export type IExportAddressData = {
  data: {
    address: string;
    path: string;
    index: number;
  }[];
  template: string;
  name: string;
};

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;
type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.FetchAddressModal
>;

type IWalletAccounts = INetworkDerivationItem & {
  accountData: (Account & { index: number })[];
};

const FROM_INDEX_MAX = 2 ** 31;

function getAccountIndex(template: string, path: string) {
  const templateParts = template.split(INDEX_PLACEHOLDER).filter(Boolean);
  let currentPath = path;
  for (const part of templateParts) {
    currentPath = currentPath.split(part).filter(Boolean)?.[0];
  }
  return currentPath.endsWith(`'`) ? currentPath.slice(0, -1) : currentPath;
}

const FetchAddressModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId, networkId, data, password } = route.params;
  const navigation = useNavigation<NavigationProps['navigation']>();

  const isHwWallet = walletId.startsWith('hw');
  const isHdWallet = walletId.startsWith('hd');
  const cancelFlagRef = useRef(false);
  const handleExportDataRef = useRef(false);
  const [progress, setProgress] = useState<number>(0);
  const [generatedAccounts, setGeneratedAccounts] = useState<
    ImportableHDAccount[]
  >([]);
  const temporaryAccountsRef = useRef<ImportableHDAccount[]>([]);
  const [previousAddress, setPreviousAddress] = useState('');

  const [walletAccounts, setWalletAccounts] = useState<IWalletAccounts[]>([]);

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
    if (data.type !== 'setRange') return;
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
    networkId,
    password,
    walletId,
    generateHDAccounts,
    updateSetRangeAccountProgress,
  ]);

  // Fetch Hardware Address
  useEffect(() => {
    if (data.type !== 'setRange') return;
    if (!isHwWallet) return;
    (async () => {
      const { fromIndex, generateCount, derivationOption } = data;
      const template = derivationOption?.template;
      if (!template) throw new Error('must be a template');
      // const result = [];
      // const hasNotExistAccount = false;
      const indexes = [];
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < Number(generateCount || 0); i++) {
        const index = Number(fromIndex) - 1 + i;
        indexes.push(index);
      }
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
    networkId,
    walletId,
    updateSetRangeAccountProgress,
    intl,
  ]);

  const updateWalletsAccountProgress = useCallback(
    (result: IWalletAccounts[], forceFinish?: boolean) => {
      if (data.type !== 'walletAccounts') return;
      const { networkDerivations } = data;
      const totalLength = networkDerivations.reduce(
        (acc, cur) => acc + cur.accounts.length,
        0,
      );
      const finishLength = result.reduce(
        (acc, cur) => acc + cur.accountData.length,
        0,
      );
      const value = forceFinish
        ? 1
        : Math.floor((finishLength / Number(totalLength)) * 100) / 100;
      setWalletAccounts(result);
      setProgress(value);
    },
    [data],
  );

  // Fetch HD Wallet Accounts
  useEffect(() => {
    if (data.type !== 'walletAccounts') return;
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
            if (isHdWallet) {
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
                debugLogger.common.error(
                  'can not find account index: ',
                  account,
                );
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
            }
            // if (isHwWallet) {
            //   const address = await backgroundApiProxy.engine.getHWAddress(
            //     account.id,
            //     networkId,
            //     walletId,
            //   );
            //   if (address !== account.address) {
            //     throw new Error('Not same address');
            //   }
            //   setPreviousAddress(address);
            // }
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
              // @ts-expect-error
              (a, b) => a.index - b.index,
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
    isHdWallet,
    updateWalletsAccountProgress,
    networkId,
    walletId,
    intl,
    password,
    navigation,
  ]);

  // Fetch Hardware Wallet Accounts
  useEffect(() => {
    if (data.type !== 'walletAccounts') return;
    if (isHdWallet) return;
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

          const hardwareAddressesResults =
            await backgroundApiProxy.serviceDerivationPath.batchGetHWAddress({
              networkId,
              walletId,
              indexes: accountData.map((i) => Number(i.index)),
              confirmOnDevice: true,
              template: networkDerivation.template,
              // fullPaths: accountData.map((i) => i.fullPath),
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
          updateWalletsAccountProgress(result);
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
    isHdWallet,
    updateWalletsAccountProgress,
    networkId,
    walletId,
    intl,
    password,
    navigation,
  ]);

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
      if (type === 'ui-previous_address_result') {
        setPreviousAddress(payloadData.address ?? '');
        backgroundApiProxy.serviceDerivationPath
          .convertPlainAddressItemToImportableHDAccount({
            networkId,
            ...payloadData,
          })
          .then((account) => {
            if (data.type === 'setRange') {
              temporaryAccountsRef.current.push(account);
              updateSetRangeAccountProgress(temporaryAccountsRef.current);
            } else {
              // updateWalletsAccountProgress(temporaryAccountsRef.current);
            }
          });
      }
    });
  }, [
    isHwWallet,
    networkId,
    updateSetRangeAccountProgress,
    data.type,
    // updateWalletsAccountProgress,
  ]);

  useEffect(() => {
    if (handleExportDataRef.current) return;
    if (progress >= 1) {
      handleExportDataRef.current = true;
      let exportData: IExportAddressData[];
      if (data.type === 'setRange') {
        exportData = [
          {
            template: data.derivationOption?.template ?? '',
            name:
              formatDerivationLabel(intl, data.derivationOption?.label) ?? '',
            data: generatedAccounts.map((account) => ({
              address: account.displayAddress,
              path: account.path,
              index: account.index,
            })),
          },
        ];
      } else {
        exportData = walletAccounts.map((networkDerivation) => ({
          template: networkDerivation.template,
          name: networkDerivation.name ?? '',
          data: networkDerivation.accountData.map((account) => ({
            index: account.index,
            address: account.address,
            path: account.path,
          })),
        }));
      }

      setTimeout(
        () => {
          if (cancelFlagRef.current) {
            return;
          }
          if (exportData.every((i) => !i.data.length)) {
            navigation.goBack();
            return;
          }
          navigation.replace(CreateAccountModalRoutes.ExportAddresses, {
            networkId,
            walletId,
            data: exportData,
          });
        },
        isHwWallet ? 0 : 500,
      );
    }
  }, [
    progress,
    data,
    generatedAccounts,
    walletAccounts,
    intl,
    networkId,
    walletId,
    isHwWallet,
    navigation,
  ]);

  const progressText = useMemo(() => {
    if (data.type === 'setRange') {
      const total = data.generateCount || '0';
      return `${
        Number.isSafeInteger(generatedAccounts.length)
          ? generatedAccounts.length
          : 0
      }/${total}`;
    }
    if (data.type === 'walletAccounts') {
      const total = data.networkDerivations.reduce(
        (acc, cur) => acc + cur.accounts.length,
        0,
      );
      const finish = walletAccounts.reduce(
        (acc, cur) => acc + cur.accountData.length,
        0,
      );
      return `${finish}/${total}`;
    }
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    generatedAccounts.length,
    walletAccounts,
    walletAccounts.length,
    progress,
  ]);

  return (
    <Modal
      height={isHwWallet ? 'auto' : '375px'}
      header={undefined}
      closeable={false}
      closeOnOverlayClick={false}
      hideSecondaryAction
      hideBackButton
      headerShown={false}
      primaryActionTranslationId="action__cancel"
      primaryActionProps={{
        type: 'basic',
      }}
      onPrimaryActionPress={async () => {
        cancelFlagRef.current = true;
        if (isHwWallet) {
          const device = await backgroundApiProxy.engine.getHWDeviceByWalletId(
            walletId,
          );
          if (device) {
            backgroundApiProxy.serviceHardware.cancel(device.mac);
          }
        }
        navigation.goBack();
      }}
    >
      <Center w="full" h="full">
        <Box mt={6}>
          <Progress.Circle
            progress={progress}
            text={
              <Center>
                <Text typography={{ sm: 'DisplayMedium', md: 'DisplayLarge' }}>
                  {progressText}
                </Text>
              </Center>
            }
          />
        </Box>
        <Text mt={6} typography={{ sm: 'Heading', md: 'Heading' }}>
          {intl.formatMessage({ id: 'title__fetching_addresses' })}
        </Text>
        {previousAddress && (
          <VStack mt={4} space={1}>
            <Text
              textAlign="center"
              typography={{ sm: 'Body2Strong', md: 'Body2Strong' }}
              color="text-subdued"
            >
              {intl.formatMessage({
                id: 'form__previous_confirmed',
              })}
            </Text>
            <Text
              typography={{ sm: 'Body2', md: 'Body2' }}
              wordBreak="break-all"
            >
              {previousAddress}
            </Text>
          </VStack>
        )}
      </Center>
    </Modal>
  );
};

export default FetchAddressModal;
