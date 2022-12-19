import { StackNavigationProp } from '@react-navigation/stack';
import { useIntl } from 'react-intl';

import {
  Box,
  Image,
  Pressable,
  Typography,
  useIsVerticalLayout,
  useTheme,
} from '@onekeyhq/components';
import keytagDark1 from '@onekeyhq/kit/assets/keytag/keytag_1_dark@2x.png';
import keytagLight1 from '@onekeyhq/kit/assets/keytag/keytag_1_light@2x.png';
import keytagDark2 from '@onekeyhq/kit/assets/keytag/keytag_2_dark@2x.png';
import keytagLight2 from '@onekeyhq/kit/assets/keytag/keytag_2_light@2x.png';

import { useNavigation } from '../../../hooks';
import LayoutContainer from '../../Onboarding/Layout';
import { useStartedKeyTagImage } from '../hooks/useKeyTagLayout';
import { KeyTagRoutes } from '../Routes/enums';
import { IKeytagRoutesParams } from '../Routes/types';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const Started = () => {
  const navigation = useNavigation<NavigationProps>();
  const { isDark } = useTheme();
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { imageWidth, imageHeight } = useStartedKeyTagImage();
  return (
    <LayoutContainer
      backButton
      // title={intl.formatMessage({ id: 'action__get_started_with_keytag' })}
      title="Get Started with KeyTag"
    >
      <Box flex="1" flexDirection={isVerticalLayout ? 'column' : 'row'}>
        <Pressable
          w={imageWidth}
          h={imageHeight}
          onPress={() => {
            navigation.navigate(KeyTagRoutes.IntroduceKeyTag);
          }}
        >
          <Box position="absolute" top="0" right="0" left="0" bottom="0">
            <Image
              source={isDark ? keytagDark1 : keytagLight1}
              borderRadius="12px"
              w={imageWidth}
              h={imageHeight}
            />
          </Box>
          <Box m={7}>
            <Typography.DisplayXLarge>Back Up Wallet</Typography.DisplayXLarge>
          </Box>
        </Pressable>
        <Pressable
          mt={isVerticalLayout ? 6 : 0}
          ml={isVerticalLayout ? 0 : 6}
          w={imageWidth}
          h={imageHeight}
          onPress={() => {
            navigation.navigate(KeyTagRoutes.ImportKeytag);
          }}
        >
          <Box position="absolute" top="0" right="0" left="0" bottom="0">
            <Image
              source={isDark ? keytagDark2 : keytagLight2}
              borderRadius="12px"
              w={imageWidth}
              h={imageHeight}
            />
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
