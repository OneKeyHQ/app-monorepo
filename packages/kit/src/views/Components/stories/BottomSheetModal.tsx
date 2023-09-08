import { useEffect } from 'react';

import { Box, Button, Center, Text } from '@onekeyhq/components';
import BottomSheetModal from '@onekeyhq/components/src/BottomSheetModal/BottomSheetModal';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import Protected from '../../../components/Protected';
import { useAppSelector } from '../../../hooks';
import { showOverlay } from '../../../utils/overlayUtils';

const showBottomSheetModal = (promiseId: string) =>
  showOverlay((close) => (
    <BottomSheetModal
      title="title"
      closeOverlay={() => {
        backgroundApiProxy.servicePassword.backgroundPromptPasswordDialogRes(
          promiseId,
          { status: EPasswordResStatus.CLOSE_STATUS },
        );
        close();
      }}
    >
      <Protected skipSavePassword walletId={null}>
        {(password, { withEnableAuthentication, isLocalAuthentication }) => {
          backgroundApiProxy.servicePassword.backgroundPromptPasswordDialogRes(
            promiseId,
            {
              status: EPasswordResStatus.PASS_STATUS,
              data: {
                password,
                options: {
                  withEnableAuthentication,
                  isLocalAuthentication,
                },
              },
            },
          );
          close();
        }}
      </Protected>
      {/* <Center w="full" h="300px" bg="border-subdued">
        <Button
          onPress={() => {
            backgroundApiProxy.servicePassword.backgroundPromptPasswordDialogResolve(
              promiseId,
              '123',
            );
            close();
          }}
        >
          点击
        </Button>
      </Center> */}
    </BottomSheetModal>
  ));

const BottomSheetModalGallery = () => {
  const passwordPrompt = useAppSelector((s) => s.data.backgroudPasswordPrompt);
  useEffect(() => {
    if (passwordPrompt && passwordPrompt.promiseId) {
      showBottomSheetModal(passwordPrompt.promiseId);
    }
  }, [passwordPrompt]);
  return (
    <Box p="20px">
      <Button
        onPress={async () => {
          const res =
            await backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
              { walletId: null },
            );
          console.log('end password', res);
        }}
      >
        Show BottomSheetModal
      </Button>
    </Box>
  );
};

export default BottomSheetModalGallery;
