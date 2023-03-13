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
import type { ImportableHDAccount } from '@onekeyhq/engine/src/types/account';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { RouteProp } from '@react-navigation/native';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;
type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.FetchAddressModal
>;

const FROM_INDEX_MAX = 2 ** 31;

const FetchAddressModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId, networkId, data, password } = route.params;

  const isHwWallet = walletId.startsWith('hw');
  const [progress, setProgress] = useState<number>(0);
  const [generatedAccounts, setGeneratedAccounts] = useState<
    ImportableHDAccount[]
  >([]);

  const updateSetRangeAccountProgress = useCallback(
    (result: any[], forceFinish?: boolean) => {
      if (data.type !== 'setRange') return;
      const { generateCount } = data;
      const value = forceFinish
        ? 1
        : Math.floor((result.length / Number(generateCount)) * 100) / 100;
      setProgress(value);
      setGeneratedAccounts(result);
      console.log(
        `progress value: ${value}, r => `,
        result,
        ` . ==length: ${result.length}`,
      );
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

  const progressText = useMemo(() => {
    let total = '0';
    if (data.type === 'setRange') {
      total = data.generateCount || '0';
    }
    return `${
      Number.isSafeInteger(generatedAccounts.length)
        ? generatedAccounts.length
        : 0
    }/${total}`;
  }, [data, generatedAccounts.length]);

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
          <Button flex={1} type="basic" size="lg">
            {intl.formatMessage({ id: 'action__cancel' })}
          </Button>
        </Box>
      </Center>
    </Modal>
  );
};

export default FetchAddressModal;
