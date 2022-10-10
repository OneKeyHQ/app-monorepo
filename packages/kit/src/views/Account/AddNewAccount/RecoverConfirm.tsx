import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, Typography } from '@onekeyhq/components';
import { IAccount } from '@onekeyhq/engine/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { toPlainErrorObject } from '@onekeyhq/shared/src/sharedUtils';

import { deviceUtils } from '../../../utils/hardware';

import type { AdvancedValues, RecoverAccountType } from './types';

type RecoverConfirmDoneProps = {
  password: string;
  accounts: RecoverAccountType[];
  walletId: string;
  network: string;
  purpose: number;
  config: AdvancedValues;
  selectedAll: boolean;
  onDone: () => void;
};
const RecoverConfirmDone: FC<RecoverConfirmDoneProps> = ({
  password,
  accounts,
  walletId,
  network,
  purpose,
  config,
  selectedAll,
  onDone,
}) => {
  const intl = useIntl();
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [importedAccounts, setImportedAccounts] = useState(0);

  const { serviceAccount, serviceAccountSelector } = backgroundApiProxy;

  const recoverAccountIndex = async (index: number[]) => {
    debugLogger.common.info('recoverAccountIndex', JSON.stringify(index));

    await serviceAccountSelector.preloadingCreateAccount({
      walletId,
      networkId: network,
    });
    return serviceAccount.addHDAccounts(
      password,
      walletId,
      network,
      index,
      undefined,
      purpose,
      true,
    );
  };

  function filterUndefined(value: any): value is number {
    return value !== undefined;
  }

  const authenticationDone = async (restoreAccounts: RecoverAccountType[]) => {
    let addedAccount: IAccount | undefined;
    try {
      const selectedAccount = restoreAccounts.filter(
        (i) => !i.isDisabled && i.selected,
      );

      const isBatch =
        selectedAll && config.generateCount && config.generateCount > 0;

      const givenExistsSize = restoreAccounts.length - selectedAccount.length;
      if (isBatch) {
        const size = (config.generateCount ?? 0) - givenExistsSize;
        setTotalAccounts(size);
      } else {
        setTotalAccounts(selectedAccount.length);
      }

      const selectedIndexes = selectedAccount
        .filter((i) => i.selected)
        .map((i) => i.index);

      const addedAccounts = await recoverAccountIndex(selectedIndexes);
      addedAccount = addedAccounts?.[0];

      setImportedAccounts(() => {
        let size = addedAccounts?.length ?? 1;
        if (isBatch && size >= givenExistsSize) {
          size -= givenExistsSize;
        }
        return size;
      });

      if (isBatch) {
        const addedMap = new Map<number, boolean>();
        selectedIndexes?.forEach((i) => addedMap.set(i, true));

        const unAddedIndexes = Array.from(
          Array((config.generateCount ?? 1) - 1).keys(),
        )
          .map((index) => {
            const i = config.fromIndex + index;
            if (addedMap.has(i)) {
              return undefined;
            }
            return i;
          })
          .filter(filterUndefined);

        // Add every 20 accounts at a time
        while (unAddedIndexes.length > 0) {
          const indexes = unAddedIndexes.splice(
            0,
            Math.min(unAddedIndexes.length, 20),
          );
          await recoverAccountIndex(indexes);
          setImportedAccounts((prev) => prev + (indexes?.length ?? 0));
        }
      }
    } catch (e: any) {
      debugLogger.common.error('recover error:', toPlainErrorObject(e));
      deviceUtils.showErrorToast(e, 'action__connection_timeout');
    } finally {
      await serviceAccountSelector.preloadingCreateAccountDone({
        walletId,
        networkId: network,
        accountId: addedAccount?.id,
      });
    }

    onDone();
  };

  useEffect(() => {
    authenticationDone(accounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Center w="full" h="full">
      <Spinner size="lg" />
      <Typography.DisplayMedium mt={3}>
        {intl.formatMessage({ id: 'action__recover_accounts' })}
      </Typography.DisplayMedium>
      <Typography.Body1 mt={2} color="text-subdued">
        {intl.formatMessage(
          { id: 'msg__recover_account_progress' },
          {
            0: importedAccounts,
            1: totalAccounts,
          },
        )}
      </Typography.Body1>
    </Center>
  );
};

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoverAccountsConfirm
>;

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;

const RecoverConfirm: FC = () => {
  const route = useRoute<RouteProps>();
  const { accounts, walletId, network, purpose, config, selectedAll } =
    route.params;
  const navigation = useNavigation<NavigationProps['navigation']>();

  return (
    <Modal
      height="640px"
      headerShown={false}
      footer={null}
      hidePrimaryAction
      hideSecondaryAction
    >
      <Protected
        walletId={walletId}
        skipSavePassword
        field={ValidationFields.Wallet}
      >
        {(password) => (
          <RecoverConfirmDone
            password={password}
            accounts={accounts}
            walletId={walletId}
            network={network}
            purpose={purpose}
            config={config}
            selectedAll={selectedAll}
            onDone={() => {
              if (navigation?.canGoBack?.()) {
                navigation?.getParent?.()?.goBack?.();
              }
            }}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default RecoverConfirm;
