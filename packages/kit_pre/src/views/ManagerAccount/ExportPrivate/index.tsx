import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Modal } from '@onekeyhq/components';
import type {
  AccountCredentialType,
  Account as AccountEngineType,
} from '@onekeyhq/engine/src/types/account';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import type { ManagerAccountRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/ManagerAccount';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { PrivateOrPublicKeyPreview } from './previewView';

import type { ManagerAccountModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type ExportPrivateViewProps = {
  accountId: string;
  networkId: string;
  password: string;
  credentialType: AccountCredentialType;
  onAccountChange: (account: AccountEngineType) => void;
};

const ExportPrivateView: FC<ExportPrivateViewProps> = ({
  accountId,
  networkId,
  password,
  credentialType,
  onAccountChange,
}) => {
  const { engine } = backgroundApiProxy;

  const [privateKey, setPrivateKey] = useState<string>();

  useEffect(() => {
    if (!accountId || !networkId || !password) return;

    engine.getAccount(accountId, networkId).then(($account) => {
      onAccountChange($account);
    });

    engine
      .getAccountPrivateKey({
        accountId,
        credentialType,
        password,
      })
      .then(($privateKey) => {
        setPrivateKey($privateKey);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, engine, networkId, password]);

  return (
    <PrivateOrPublicKeyPreview
      privateOrPublicKey={privateKey}
      qrCodeContainerSize={{ base: 296, md: 208 }}
    />
  );
};

type NavigationProps = RouteProp<
  ManagerAccountRoutesParams,
  ManagerAccountModalRoutes.ManagerAccountExportPrivateModal
>;

const ExportPrivateViewModal = () => {
  const intl = useIntl();
  const route = useRoute<NavigationProps>();
  const { accountId, networkId, accountCredential } = route.params;
  const [account, setAccount] = useState<AccountEngineType>();

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: accountCredential.key })}
      headerDescription={account?.name}
      height="auto"
    >
      <Protected
        walletId={null}
        skipSavePassword
        field={ValidationFields.Secret}
      >
        {(pwd) => (
          <ExportPrivateView
            accountId={accountId}
            networkId={networkId}
            credentialType={accountCredential.type}
            password={pwd}
            onAccountChange={(acc) => setAccount(acc)}
          />
        )}
      </Protected>
    </Modal>
  );
};
export default ExportPrivateViewModal;
