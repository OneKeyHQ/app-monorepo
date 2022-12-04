import { Box, Button, Center, Text } from '@onekeyhq/components';
import BottomSheetModal from '@onekeyhq/components/src/BottomSheetModal/BottomSheetModal';

import { showOverlay } from '../../../utils/overlayUtils';

const showBottomSheetModal = () =>
  showOverlay((close) => (
    <BottomSheetModal title="title" closeOverlay={close}>
      <Center w="full" h="300px" bg="border-subdued">
        <Text>PlaceHolder</Text>
      </Center>
    </BottomSheetModal>
  ));

const BottomSheetModalGallery = () => (
  <Box p="20px">
    <Button onPress={showBottomSheetModal}>Show BottomSheetModal</Button>
  </Box>
);

export default BottomSheetModalGallery;
