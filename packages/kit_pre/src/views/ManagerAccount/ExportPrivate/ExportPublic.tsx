import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Modal } from '@onekeyhq/components';
import type {
  Account as AccountEngineType,
  DBUTXOAccount,
} from '@onekeyhq/engine/src/types/account';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import type { ManagerAccountRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/ManagerAccount';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { deviceUtils } from '../../../utils/hardware';

import { PrivateOrPublicKeyPreview } from './previewView';

import type { ManagerAccountModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type ExportPublicKeyViewProps = {
  walletId: string;
  accountId: string;
  networkId: string;
  password: string;
  onAccountChange: (account: AccountEngineType) => void;
};

const ExportPublicKeyView: FC<ExportPublicKeyViewProps> = ({
  walletId,
  accountId,
  networkId,
  password,
  onAccountChange,
}) => {
  const { engine } = backgroundApiProxy;

  const [publicKey, setPublicKey] = useState<string>();
  const navigation = useAppNavigation();

  useEffect(() => {
    (async () => {
      try {
        if (!accountId || !networkId) return;
        const account = await engine.getAccount(accountId, networkId);
        onAccountChange(account);
        const recomputeAccount = await engine.recomputeAccount({
          walletId,
          networkId,
          accountId,
          password,
          path: account.path,
          template: account.template,
          confirmOnDevice: true,
        });
        if (recomputeAccount) {
          setPublicKey((recomputeAccount as DBUTXOAccount).xpub);
        }
      } catch (e) {
        deviceUtils.showErrorToast(e);
        navigation.goBack?.();
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletId, accountId, engine, networkId, password]);

  return (
    <PrivateOrPublicKeyPreview
      privateOrPublicKey={publicKey}
      qrCodeContainerSize={{ base: 296, md: 208 }}
    />
  );
};

type NavigationProps = RouteProp<
  ManagerAccountRoutesParams,
  ManagerAccountModalRoutes.ManagerAccountExportPublicModal
>;

const ExportPrivateViewModal = () => {
  const intl = useIntl();
  const route = useRoute<NavigationProps>();
  const { accountId, networkId, walletId } = route.params;
  const [account, setAccount] = useState<AccountEngineType>();

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'title__export_public_key' })}
      headerDescription={account?.name}
      height="auto"
    >
      <Protected
        walletId={walletId}
        skipSavePassword
        field={ValidationFields.Secret}
      >
        {(pwd) => (
          <ExportPublicKeyView
            accountId={accountId}
            networkId={networkId}
            walletId={walletId}
            password={pwd}
            onAccountChange={(acc) => setAccount(acc)}
          />
        )}
      </Protected>
    </Modal>
  );
};
export default ExportPrivateViewModal;
