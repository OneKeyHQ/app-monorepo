import { StackNavigationProp } from '@react-navigation/stack';

import {
  Box,
  Image,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import iconNFCScanHint from '@onekeyhq/kit/assets/hardware/ic_pair_hint_scan_lite.png';

import { useNavigation } from '../../../hooks';
import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagRoutes } from '../Routes/enums';
import { IKeytagRoutesParams } from '../Routes/types';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const fakeData =
  'birth buyer maple betray miss junk assume citizen agent toward hurdle jacket awful crater ball harbor spin basic';

const Started = () => {
  const navigation = useNavigation<NavigationProps>();
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <LayoutContainer backButton title="Get Started with KeyTag">
      <Box flex="1" flexDirection={isVerticalLayout ? 'column' : 'row'}>
        <Pressable
          borderRadius="12px"
          bgColor="border-subdued"
          onPress={() => {
            // navigation.navigate(KeyTagRoutes.ShowDotMap, {
            //   mnemonicWords: fakeData,
            // });
            navigation.navigate(KeyTagRoutes.IntroduceKeyTag);
          }}
        >
          <Box position="absolute" top="0" right="0" left="0" bottom="0">
            <Image source={iconNFCScanHint} />
          </Box>
          <Box m={7}>
            <Typography.DisplayXLarge>Back Up Wallet</Typography.DisplayXLarge>
          </Box>
        </Pressable>
        <Pressable
          borderRadius="12px"
          bgColor="border-subdued"
          onPress={() => {
            navigation.navigate(KeyTagRoutes.ImportKeytag);
          }}
        >
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
