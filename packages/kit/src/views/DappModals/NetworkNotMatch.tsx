import { Image } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  Icon,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { getNetworkImplFromDappScope } from '@onekeyhq/shared/src/background/backgroundUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import Logo from '../../../assets/logo_round.png';
import { useNavigationActions } from '../../hooks';
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
              <Image
                w="full"
                h="full"
                borderRadius="full"
                zIndex={100}
                source={Logo}
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
            {intl.formatMessage({ id: 'msg__mismatched_networks' })}
          </Typography.DisplayLarge>
          <Typography.Body1 color="text-subdued">
            {sourceInfo?.hostname || ''}
          </Typography.Body1>
          <Icon name="ArrowsUpDownOutline" />
          <Typography.Body1 color="text-subdued">
            {sourceInfo?.scope?.toUpperCase() || ''}
          </Typography.Body1>

          <Typography.Body1 color="text-subdued" textAlign="center" my={4}>
            The currently selected network and dApp do not match, Select a
            network and account to connect.
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
