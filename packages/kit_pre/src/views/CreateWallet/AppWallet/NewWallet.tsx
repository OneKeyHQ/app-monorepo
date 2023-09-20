import type { FC } from 'react';
import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import type { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/CreateWallet';
import { CreateWalletModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

type NewWalletProps = {
  password: string;
  withEnableAuthentication?: boolean;
};

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

const NewWallet: FC<NewWalletProps> = ({
  password,
  withEnableAuthentication,
}) => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  useEffect(() => {
    navigation.replace(CreateWalletModalRoutes.AttentionsModal, {
      password,
      withEnableAuthentication,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

export const NewWalletModal = () => (
  <Modal footer={null}>
    {/* new wallet walletId is null */}
    <Protected walletId={null} skipSavePassword field={ValidationFields.Wallet}>
      {(password, { withEnableAuthentication }) => (
        <NewWallet
          password={password}
          withEnableAuthentication={withEnableAuthentication}
        />
      )}
    </Protected>
  </Modal>
);

export default NewWalletModal;
