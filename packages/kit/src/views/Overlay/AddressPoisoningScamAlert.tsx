import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Button,
  Center,
  HStack,
  Icon,
  Text,
} from '@onekeyhq/components';

import { useClipboard } from '../../hooks/useClipboard';
import { showOverlay } from '../../utils/overlayUtils';

function AddressPoisoningScamAlertBottomSheetModal({
  address,
  closeOverlay,
}: {
  address: string;
  closeOverlay: () => void;
}) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  return (
    <BottomSheetModal
      title=""
      closeOverlay={closeOverlay}
      showCloseButton={false}
    >
      <Center mt={-10}>
        <Box
          width={12}
          height={12}
          borderRadius="full"
          alignItems="center"
          justifyContent="center"
          bgColor="surface-critical-default"
        >
          <Icon
            name="ExclamationTriangleOutline"
            size={24}
            color="icon-critical"
          />
        </Box>
      </Center>
      <Box>
        <Text
          textAlign="center"
          typography="DisplayMedium"
          fontSize={20}
          mt={5}
        >
          {intl.formatMessage({
            id: 'title__beware_of_address_poisoning_scams',
          })}
        </Text>
        <Text
          textAlign="center"
          typography="Body2"
          color="text-subdued"
          mt={2}
          fontSize={14}
        >
          {intl.formatMessage({
            id: 'title__beware_of_address_poisoning_scams_desc',
          })}
        </Text>
        <Text
          textAlign="center"
          typography="Body2"
          color="text-subdued"
          mt={5}
          fontSize={14}
        >
          {address}
        </Text>
      </Box>
      <HStack space={3} mt={6} pb={5}>
        <Button size="xl" flex={1} onPress={() => closeOverlay()}>
          {intl.formatMessage({ id: 'action__cancel' })}
        </Button>
        <Button
          flex={1}
          size="xl"
          type="destructive"
          onPress={() => {
            copyText(address);
            closeOverlay();
          }}
        >
          {intl.formatMessage({ id: 'action__copy_address' })}
        </Button>
      </HStack>
    </BottomSheetModal>
  );
}

const showAddressPoisoningScamAlert = (address: string) => {
  showOverlay((close) => (
    <AddressPoisoningScamAlertBottomSheetModal
      address={address}
      closeOverlay={close}
    />
  ));
};

export { showAddressPoisoningScamAlert };
