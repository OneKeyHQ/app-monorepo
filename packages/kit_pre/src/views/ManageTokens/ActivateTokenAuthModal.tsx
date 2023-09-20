/* eslint-disable react-hooks/exhaustive-deps */
import type { FC } from 'react';
import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../../components/Protected';

import type { ManageTokenModalRoutes } from '../../routes/routesEnum';
import type { ManageTokenRoutesParams } from './types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type EnableLocalAuthenticationProps = {
  password: string;
  accountId: string;
  networkId: string;
  tokenId: string;
  onSuccess?: () => void;
  onFailure?: (error?: Error) => void;
};

const Done: FC<EnableLocalAuthenticationProps> = ({
  password,
  accountId,
  networkId,
  tokenId,
  onSuccess,
  onFailure,
}) => {
  const navigation = useNavigation();

  useEffect(() => {
    if (accountId && networkId && tokenId) {
      (async () => {
        try {
          const result = await backgroundApiProxy.engine.activateToken(
            password,
            accountId,
            networkId,
            tokenId,
          );
          if (result) {
            onSuccess?.();
          } else {
            onFailure?.();
          }
        } catch (e: any) {
          debugLogger.sendTx.error(e);
          onFailure?.(e);
        }
        navigation.goBack();
      })();
    }
  }, []);

  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

type NavigationProps = NativeStackScreenProps<
  ManageTokenRoutesParams,
  ManageTokenModalRoutes.ActivateToken
>;

const ActivateTokenAuthModal: FC<NavigationProps> = ({ route }) => {
  const intl = useIntl();
  const { walletId, accountId, networkId, tokenId, onSuccess, onFailure } =
    route.params || {};

  return (
    <Modal
      header={intl.formatMessage({
        id: 'action__add_custom_tokens',
        defaultMessage: 'Add Token',
      })}
      headerDescription={intl.formatMessage({
        id: 'msg__aptos_first_activation_token',
      })}
      hideSecondaryAction
      hidePrimaryAction
      footer={null}
    >
      <Protected
        walletId={walletId}
        skipSavePassword
        field={ValidationFields.Payment}
      >
        {(password) => (
          <Done
            accountId={accountId}
            networkId={networkId}
            tokenId={tokenId}
            password={password}
            onSuccess={onSuccess}
            onFailure={onFailure}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default ActivateTokenAuthModal;
