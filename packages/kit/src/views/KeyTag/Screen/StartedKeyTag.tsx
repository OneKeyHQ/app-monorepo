import { StackNavigationProp } from '@react-navigation/stack';

import { Box, Image, Pressable, Typography } from '@onekeyhq/components';
import iconNFCScanHint from '@onekeyhq/kit/assets/hardware/ic_pair_hint_scan_lite.png';

import { useNavigation } from '../../../hooks';
import LayoutContainer from '../../Onboarding/Layout';
import { IKeytagRoutesParams } from '../Routes/types';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const Started = () => {
  const navigation = useNavigation<NavigationProps>();
  return (
    <LayoutContainer backButton title="Get Started with KeyTag">
      <Box flex="1">
        <Pressable>
          <Box position="absolute" top="0" right="0" left="0" bottom="0">
            <Image source={iconNFCScanHint} />
          </Box>
          <Box m={7}>
            <Typography.DisplayXLarge>Back Up Wallet</Typography.DisplayXLarge>
          </Box>
        </Pressable>
        <Pressable>
          <Box position="absolute" top="0" right="0" left="0" bottom="0">
            <Image source={iconNFCScanHint} />
          </Box>
          <Box m={7}>
            <Typography.DisplayXLarge>Import Wallet</Typography.DisplayXLarge>
          </Box>
        </Pressable>
      </Box>
    </LayoutContainer>
  );
};

export default Started;
