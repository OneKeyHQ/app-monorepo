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
import type { CreateAccountRoutesParams } from '@onekeyhq/kit/src/routes';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { toPlainErrorObject } from '@onekeyhq/shared/src/utils/errorUtils';

import { wait } from '../../../utils/helper';

import type { CreateAccountModalRoutes } from '../../../routes/routesEnum';
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

  const { serviceAccount, serviceAccountSelector, engine } = backgroundApiProxy;
  const stopRecoverFlag = useRef(stopFlag);

  // Prevents screen locking
  useKeepAwake();

  useEffect(() => {
    stopRecoverFlag.current = stopFlag;
  }, [stopFlag]);

  const recoverAccountIndex = async (index: number[], lastGroup: boolean) => {
    debugLogger.common.info('recoverAccountIndex', JSON.stringify(index));

    if (lastGroup) {
      await serviceAccountSelector.preloadingCreateAccount({
        walletId,
        networkId: network,
        template,
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
    }
    return engine.addHdOrHwAccounts({
      password,
      walletId,
      networkId: network,
      indexes: index,
      names: undefined,
      purpose,
      skipRepeat: true,
      template,
    });
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

      // Add every 10 accounts at a time
      while (unAddedIndexes.length > 0) {
        const indexes = unAddedIndexes.splice(
          0,
          Math.min(unAddedIndexes.length, 10),
        );
        const isLastGroup = unAddedIndexes.length === 0;
        const recoverAccounts = await recoverAccountIndex(indexes, isLastGroup);
        if (recoverAccounts?.[0]) {
          addedAccount = recoverAccounts?.[0];
        }
        setImportedAccounts((prev) => prev + (indexes?.length ?? 0));

        if (stopRecoverFlag.current) {
          if (!isLastGroup && addedAccount) {
            await serviceAccount.postAccountAdded({
              walletId,
              networkId: network,
              account: addedAccount,
              walletType: walletId.startsWith('hw-') ? 'hw' : 'hd',
              checkOnBoarding: false,
              checkPasswordSet: false,
              shouldBackup: true,
              password,
            });
          }
          break;
        }
        if (!isLastGroup) {
          // for response ui event
          await wait(50);
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
        template,
      });
    }

    onDone();
  };

  useEffect(() => {
    setTimeout(() => {
      authenticationDone(accounts);
    });
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
        field={ValidationFields.Account}
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
              config={config as AdvancedValues}
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
