import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Modal } from '@onekeyhq/components';
import Protected from '@onekeyhq/kit/src/components/Protected';
import { PrivateOrPublicKeyPreview } from '@onekeyhq/kit/src/views/ManagerAccount/ExportPrivate/previewView';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { deviceUtils } from '../../utils/hardware';

import type { NostrRoutesParams } from '../../routes';
import type { NostrModalRoutes } from '../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = RouteProp<
  NostrRoutesParams,
  NostrModalRoutes.ExportPubkey
>;

const ExportPublicKeyView: FC<{
  walletId: string;
  networkId: string;
  accountId: string;
  password: string;
}> = ({ walletId, networkId, accountId, password }) => {
  const [publicKey, setPublicKey] = useState<string>();
  const navigation = useAppNavigation();

  useEffect(() => {
    (async () => {
      try {
        const pubkey =
          await backgroundApiProxy.serviceNostr.getPublicKeyEncodedByNip19({
            walletId,
            networkId,
            accountId,
            password,
          });
        setPublicKey(pubkey);
      } catch (e) {
        deviceUtils.showErrorToast(e);
        navigation.goBack?.();
      }
    })();
  }, [walletId, networkId, accountId, password, navigation]);

  return (
    <PrivateOrPublicKeyPreview
      privateOrPublicKey={publicKey}
      qrCodeContainerSize={{ base: 296, md: 208 }}
    />
  );
};

const ExportPubkeyModal = () => {
  const intl = useIntl();
  const route = useRoute<NavigationProps>();
  const { walletId, networkId, accountId } = route.params;

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'title__nostr_public_key' })}
      height="auto"
    >
      <Protected walletId={walletId}>
        {(pwd) => (
          <ExportPublicKeyView
            walletId={walletId}
            networkId={networkId}
            accountId={accountId}
            password={pwd}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default ExportPubkeyModal;
