import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Modal,
  Progress,
  Text,
} from '@onekeyhq/components';
import type {
  Account,
  ImportableHDAccount,
} from '@onekeyhq/engine/src/types/account';
import { INDEX_PLACEHOLDER } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { CreateAccountModalRoutes } from '../../../routes';

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
  const [progress, setProgress] = useState<number>(0);
  const [generatedAccounts, setGeneratedAccounts] = useState<
    ImportableHDAccount[]
  >([]);

  const [walletAccounts, setWalletAccounts] = useState<IWalletAccounts[]>([]);

  const updateSetRangeAccountProgress = useCallback(
    (result: any[], forceFinish?: boolean) => {
      if (data.type !== 'setRange') return;
      const { generateCount } = data;
      const value = forceFinish
        ? 1
        : Math.floor((result.length / Number(generateCount)) * 100) / 100;
      setProgress(value);
      setGeneratedAccounts(result);
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
      while (start < startIndex + finalLimit) {
        let offset = pageSize;
        if (start + pageSize > startIndex + finalLimit) {
          offset = start + finalLimit - start;
        }
        if (offset <= 0) {
          break;
        }
        const accounts = await generateHDAccounts({
          start,
          offset,
          purpose,
          template,
        });
        result.push(...accounts);
        start += pageSize;
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
      const result = [];
      let hasNotExistAccount = false;
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < Number(generateCount || 0); i++) {
        const index = Number(fromIndex) - 1 + i;
        try {
          const addressInfo =
            await backgroundApiProxy.serviceDerivationPath.getHWAddressByTemplate(
              {
                networkId,
                walletId,
                index,
                template,
              },
            );
          if (!addressInfo.accountExist) {
            if (hasNotExistAccount) {
              // If there is already no transaction record of the account, the result will be returned directly
              updateSetRangeAccountProgress(result, true);
              break;
            }
            hasNotExistAccount = true;
          }
          result.push(addressInfo);
          updateSetRangeAccountProgress(result);
        } catch (e) {
          debugLogger.common.info('getHWAddressByTemplate error: ', e);
          updateSetRangeAccountProgress(result, true);
          break;
        }
      }
    })();
  }, [data, isHwWallet, networkId, walletId, updateSetRangeAccountProgress]);

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
      setProgress(value);
      setWalletAccounts(result);
    },
    [data],
  );

  // Fetch Wallet Accounts
  useEffect(() => {
    if (data.type !== 'walletAccounts') return;
    (async () => {
      const { networkDerivations } = data;
      const result: IWalletAccounts[] = [];
      for (const networkDerivation of networkDerivations) {
        const accounts = await backgroundApiProxy.engine.getAccounts(
          networkDerivation.accounts,
        );
        const accountData = [];
        for (const account of accounts) {
          if (isHwWallet) {
            const address = await backgroundApiProxy.engine.getHWAddress(
              account.id,
              networkId,
              walletId,
            );
            if (address !== account.address) {
              throw new Error('Not same address');
            }
          }
          accountData.push({
            ...account,
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
        }
      }
    })();
  }, [data, isHwWallet, updateWalletsAccountProgress, networkId, walletId]);

  useEffect(() => {
    if (progress >= 1) {
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
    navigation,
    networkId,
    walletId,
    isHwWallet,
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
      header={undefined}
      footer={null}
      closeable={false}
      closeOnOverlayClick={false}
      hidePrimaryAction
      hideSecondaryAction
      hideBackButton
    >
      <Center>
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
        <Text my={6} typography={{ sm: 'Heading', md: 'Heading' }}>
          {intl.formatMessage({ id: 'title__fetching_addresses' })}
        </Text>
        <Box w="full">
          <Button
            flex={1}
            type="basic"
            size="lg"
            onPress={() => navigation.goBack()}
          >
            <Text typography={{ sm: 'Button1', md: 'Button1' }}>
              {intl.formatMessage({ id: 'action__cancel' })}
            </Text>
          </Button>
        </Box>
      </Center>
    </Modal>
  );
};

export default FetchAddressModal;
