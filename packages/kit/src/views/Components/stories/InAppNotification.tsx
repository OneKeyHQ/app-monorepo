import { Box, Button, useThemeValue } from '@onekeyhq/components';
import { showNotification } from '@onekeyhq/components/src/utils/showNotification';

const InAppNotificationGallery = () => {
  const bg = useThemeValue('background-default');
  return (
    <Box w="full" h="full" bg={bg} p="10">
      <Button
        onPress={() => {
          showNotification({
            title: '😀 Notification',
            subtitle: 'Subtitle',
            cover: 'https://onekey.so/assets/images/onekey-logo.png',
            linkedRoute: 'Home',
          });
        }}
      >
        showNotification
      </Button>
    </Box>
  );
};

export default InAppNotificationGallery;
