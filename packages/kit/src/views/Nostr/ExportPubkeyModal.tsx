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
  password: string;
}> = ({ walletId, password }) => {
  const [publicKey, setPublicKey] = useState<string>();
  const navigation = useAppNavigation();

  useEffect(() => {
    (async () => {
      try {
        const pubkey =
          await backgroundApiProxy.serviceNostr.getPublicKeyEncodedByNip19({
            walletId,
            password,
          });
        setPublicKey(pubkey);
      } catch (e) {
        deviceUtils.showErrorToast(e);
        navigation.goBack?.();
      }
    })();
  }, [walletId, password, navigation]);

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
  const { walletId } = route.params;

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'title__export_public_key' })}
      headerDescription="Nostr"
      height="auto"
    >
      <Protected walletId={walletId}>
        {(pwd) => <ExportPublicKeyView walletId={walletId} password={pwd} />}
      </Protected>
    </Modal>
  );
};

export default ExportPubkeyModal;
