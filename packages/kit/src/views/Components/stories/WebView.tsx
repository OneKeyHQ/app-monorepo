import { Box, Button } from '@onekeyhq/components';

import WebView from '../../../components/WebView';
import useNavigation from '../../../hooks/useNavigation';

const Settings = () => {
  const navigation = useNavigation();

  return (
    <Box flex="1" bg="background-hovered">
      <Button
        onPress={() => {
          navigation.navigate('Components/Approval' as any);
        }}
      >
        Send Transaction
      </Button>
      <WebView src="https://app.uniswap.org/#/swap" />
    </Box>
  );
};

export default Settings;
