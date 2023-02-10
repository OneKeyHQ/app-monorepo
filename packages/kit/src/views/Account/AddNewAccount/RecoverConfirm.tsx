import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, Typography } from '@onekeyhq/components';
import type { IAccount } from '@onekeyhq/engine/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { SkipAppLock } from '@onekeyhq/kit/src/components/AppLock';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import type {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { toPlainErrorObject } from '@onekeyhq/shared/src/utils/errorUtils';

import type { AdvancedValues, RecoverAccountType } from './types';
import type { RouteProp } from '@react-navigation/native';

type RecoverConfirmDoneProps = {
  password: string;
  accounts: RecoverAccountType[];
  walletId: string;
  network: string;
  purpose: number;
  template: string;
  config: AdvancedValues;
  stopFlag: boolean;
  onDone: () => void;
};
const RecoverConfirmDone: FC<RecoverConfirmDoneProps> = ({
  password,
  accounts,
  walletId,
  network,
  purpose,
  template,
  config,
  stopFlag,
  onDone,
}) => {
  const intl = useIntl();
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [importedAccounts, setImportedAccounts] = useState(0);

  const { serviceAccount, serviceAccountSelector } = backgroundApiProxy;
  const stopRecoverFlag = useRef(stopFlag);

  // Prevents screen locking
  useKeepAwake();

  useEffect(() => {
    stopRecoverFlag.current = stopFlag;
  }, [stopFlag]);

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
      template,
    );
  };

  function filterUndefined(value: any): value is number {
    return value !== undefined;
  }

  const authenticationDone = async (restoreAccounts: RecoverAccountType[]) => {
    let addedAccount: IAccount | undefined;
    try {
      const isBatchMode = config.generateCount && config.generateCount > 0;

      let unAddedIndexes: number[] = [];

      if (isBatchMode) {
        const ignoreAccount = new Set<number>();
        restoreAccounts?.forEach((i) => {
          // existent account
          if (i.isDisabled && i.selected) {
            ignoreAccount.add(i.index);
          }
          // unselected account
          if (!i.selected) {
            ignoreAccount.add(i.index);
          }
        });

        unAddedIndexes = Array.from(Array(config.generateCount ?? 1).keys())
          .map((index) => {
            const i = index + config.fromIndex - 1;
            if (ignoreAccount.has(i)) {
              return undefined;
            }
            return i;
          })
          .filter(filterUndefined);
      } else {
        unAddedIndexes = restoreAccounts
          .filter((i) => i.selected && !i.isDisabled)
          .map((i) => i.index);
      }

      setTotalAccounts(unAddedIndexes.length);

      // Add every 20 accounts at a time
      while (unAddedIndexes.length > 0) {
        const indexes = unAddedIndexes.splice(
          0,
          Math.min(unAddedIndexes.length, 20),
        );
        const recoverAccounts = await recoverAccountIndex(indexes);
        if (recoverAccounts?.[0]) {
          addedAccount = recoverAccounts?.[0];
        }
        setImportedAccounts((prev) => prev + (indexes?.length ?? 0));

        if (stopRecoverFlag.current) break;
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
      <SkipAppLock />
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

      {stopFlag && (
        <Typography.Body2 position="absolute" bottom={1} color="text-subdued">
          {intl.formatMessage({ id: 'msg__recover_account_stopping' })}
        </Typography.Body2>
      )}
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
  const { accounts, walletId, network, purpose, config, template } =
    route.params;
  const navigation = useNavigation<NavigationProps['navigation']>();

  const [stopFlag, setStopFlag] = useState(false);
  const [recovering, setRecovering] = useState(false);

  return (
    <Modal
      height="340px"
      headerShown={false}
      hidePrimaryAction
      onSecondaryActionPress={() => {
        if (recovering) {
          setStopFlag(true);
        } else {
          navigation.goBack();
        }
      }}
    >
      <Protected
        walletId={walletId}
        skipSavePassword
        field={ValidationFields.Wallet}
      >
        {(password) => {
          setRecovering(true);
          return (
            <RecoverConfirmDone
              password={password}
              accounts={accounts}
              walletId={walletId}
              network={network}
              purpose={purpose}
              template={template}
              config={config}
              stopFlag={stopFlag}
              onDone={() => {
                if (navigation?.canGoBack?.()) {
                  navigation?.getParent?.()?.goBack?.();
                }
              }}
            />
          );
        }}
      </Protected>
    </Modal>
  );
};

export default RecoverConfirm;
