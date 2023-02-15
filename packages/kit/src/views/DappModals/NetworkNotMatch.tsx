import { Image } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  Icon,
  Modal,
  Token,
  Typography,
  VStack,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { getNetworkImplFromDappScope } from '@onekeyhq/shared/src/background/backgroundUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { useActiveWalletAccount, useNavigationActions } from '../../hooks';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';
import { EAccountSelectorMode } from '../../store/reducers/reducerAccountSelector';
import { wait } from '../../utils/helper';

const NetworkNotMatch = () => {
  const intl = useIntl();
  const { sourceInfo } = useDappParams();
  const { id } = sourceInfo ?? ({} as IDappSourceInfo);
  const { openNetworkSelector } = useNavigationActions();
  const closeThisModal = useModalClose();
  const { network } = useActiveWalletAccount();

  const dappApprove = useDappApproveAction({
    id,
    closeOnError: true,
  });

  // TODO define <DappModal /> trigger onModalClose() on gesture close
  return (
    <Modal
      footer={null}
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{ isDisabled: true }}
      hidePrimaryAction
      secondaryActionTranslationId="action__cancel"
      onSecondaryActionPress={({ close }) => {
        dappApprove.reject();
        close();
      }}
      onModalClose={dappApprove.reject}
    >
      <Center flex={1}>
        <VStack alignItems="center" mb={4}>
          <HStack alignItems="center">
            <Box
              size="64px"
              borderWidth={2}
              borderColor="surface-subdued"
              mr="-16px"
              zIndex={1}
              rounded="full"
            >
              <Image
                w="full"
                h="full"
                source={{ uri: `${sourceInfo?.origin || ''}/favicon.ico` }}
                fallbackElement={
                  <Center
                    width="full"
                    height="full"
                    borderRadius="full"
                    bg="background-selected"
                  >
                    <Icon name="QuestionMarkOutline" />
                  </Center>
                }
              />
            </Box>
            <Box
              size="64px"
              overflow="hidden"
              borderWidth={2}
              zIndex={2}
              rounded="full"
              borderColor="surface-subdued"
              bg="surface-subdued"
              position="relative"
            >
              <Token
                size="64px"
                token={{
                  logoURI: network?.logoURI,
                  name: network?.shortName,
                }}
              />
            </Box>

            <Box
              size="20px"
              rounded="full"
              bg="surface-subdued"
              position="absolute"
              right={0}
              bottom={0}
              zIndex={200}
            >
              <Icon
                size={20}
                name="ExclamationCircleSolid"
                color="icon-critical"
              />
            </Box>
          </HStack>

          <Typography.DisplayLarge mt={4} mb={2}>
            {intl.formatMessage({ id: 'title__network_mismatch' })}
          </Typography.DisplayLarge>
          <Typography.Body1 color="text-subdued">
            {sourceInfo?.hostname || ''}
          </Typography.Body1>

          <Typography.Body1 color="text-subdued" textAlign="center" my={4}>
            {intl.formatMessage({ id: 'title__network_mismatch_desc' })}
          </Typography.Body1>
        </VStack>
      </Center>
      <Button
        type="primary"
        size="xl"
        onPress={async () => {
          closeThisModal();
          await wait(350);
          const networkImpl = sourceInfo?.scope
            ? getNetworkImplFromDappScope(sourceInfo?.scope)
            : '';
          openNetworkSelector({
            mode: EAccountSelectorMode.Wallet,
            networkImpl,
          });
        }}
      >
        {intl.formatMessage({ id: 'action__switch' })}
      </Button>
    </Modal>
  );
};

export default NetworkNotMatch;
