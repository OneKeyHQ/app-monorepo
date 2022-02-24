/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React from 'react';

import { useNavigation } from '@react-navigation/core';
import { Column } from 'native-base';

import { Button } from '@onekeyhq/components';
import {
  DappApproveModalRoutes,
  DappApproveRoutesParams,
  DappConnectionModalRoutes,
  DappConnectionRoutesParams,
  DappMulticallModalRoutes,
  DappMulticallRoutesParams,
  DappSendModalRoutes,
  DappSendRoutesParams,
  DappSignatureModalRoutes,
  DappSignatureRoutesParams,
} from '@onekeyhq/kit/src/routes';

import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '../../../routes/types';

type DappNavigationProps = ModalScreenProps<DappApproveRoutesParams> &
  ModalScreenProps<DappMulticallRoutesParams> &
  ModalScreenProps<DappSendRoutesParams> &
  ModalScreenProps<DappSignatureRoutesParams> &
  ModalScreenProps<DappConnectionRoutesParams>;

const DappModalsGallery = () => {
  const navigation = useNavigation<DappNavigationProps['navigation']>();

  const openSendConfirmModal = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.DappSendConfirmModal,
      params: {
        screen: DappSendModalRoutes.SendConfirmModal,
      },
    });
  };
  const openApproveModal = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.DappApproveModal,
      params: {
        screen: DappApproveModalRoutes.ApproveModal,
      },
    });
  };
  const openMulticallModal = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.DappMulticallModal,
      params: {
        screen: DappMulticallModalRoutes.MulticallModal,
      },
    });
  };
  const openSignatureModal = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.DappSignatureModal,
      params: {
        screen: DappSignatureModalRoutes.SignatureModal,
      },
    });
  };
  const openConnectionModal = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.DappConnectionModal,
      params: {
        screen: DappConnectionModalRoutes.ConnectionModal,
      },
    });
  };

  return (
    <Column flex="1" bg="background-hovered" p={4} space={2}>
      <Button size="lg" onPress={openApproveModal}>
        Open Approve Modal
      </Button>
      <Button size="lg" onPress={openSendConfirmModal}>
        Open Send Confirm Modal
      </Button>
      <Button size="lg" onPress={openMulticallModal}>
        Open Multicall Modal
      </Button>
      <Button size="lg" onPress={openSignatureModal}>
        Open Signature Modal
      </Button>
      <Button size="lg" onPress={openConnectionModal}>
        Open Connection Modal
      </Button>
    </Column>
  );
};

export default DappModalsGallery;
