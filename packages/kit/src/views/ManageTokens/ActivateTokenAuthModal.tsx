/* eslint-disable react-hooks/exhaustive-deps */
import { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../../components/Protected';
import { deviceUtils } from '../../utils/hardware';

import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type EnableLocalAuthenticationProps = {
  password: string;
  accountId: string;
  networkId: string;
  tokenId: string;
  onSuccess?: () => void;
  onFailure?: () => void;
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
        } catch (e) {
          debugLogger.sendTx.error(e);
          onFailure?.();
          deviceUtils.showErrorToast(e);
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
  ManageTokenRoutes.ActivateToken
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
      hideSecondaryAction
      hidePrimaryAction
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
