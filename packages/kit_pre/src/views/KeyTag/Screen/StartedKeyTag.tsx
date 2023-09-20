import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Icon,
  Image,
  Pressable,
  Typography,
  useIsVerticalLayout,
  useTheme,
} from '@onekeyhq/components';
import keytagDark1 from '@onekeyhq/kit/assets/keytag/keytag_1_dark.png';
import keytagLight1 from '@onekeyhq/kit/assets/keytag/keytag_1_light.png';
import keytagDark2 from '@onekeyhq/kit/assets/keytag/keytag_2_dark.png';
import keytagLight2 from '@onekeyhq/kit/assets/keytag/keytag_2_light.png';

import { useNavigation } from '../../../hooks';
import { openUrlExternal } from '../../../utils/openUrl';
import LayoutContainer from '../../Onboarding/Layout';
import { useStartedKeyTagImage } from '../hooks/useKeyTagLayout';
import { KeyTagRoutes } from '../Routes/enums';
import { keyTagShoppingUrl } from '../utils';

import type { IKeytagRoutesParams } from '../Routes/types';
import type { StackNavigationProp } from '@react-navigation/stack';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const Started = () => {
  const navigation = useNavigation<NavigationProps>();
  const { isDark } = useTheme();
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { imageWidth, imageHeight, imageBoxWidth, imageBoxHeight } =
    useStartedKeyTagImage();

  return (
    <LayoutContainer
      backButton
      title={intl.formatMessage({ id: 'title__get_started_with_keytag' })}
    >
      <Box flex="1" flexDirection={isVerticalLayout ? 'column' : 'row'}>
        <Pressable
          w={imageBoxWidth}
          h={imageBoxHeight}
          bgColor={isDark ? '#040407' : '#ECEDEE'}
          borderColor="border-subdued"
          borderWidth={StyleSheet.hairlineWidth}
          borderRadius="12px"
          onPress={() => {
            navigation.navigate(KeyTagRoutes.IntroduceKeyTag);
          }}
        >
          <Box position="absolute" top="0" right="0" bottom="1">
            <Image
              source={isDark ? keytagDark1 : keytagLight1}
              borderRadius="12px"
              w={imageWidth}
              h={imageHeight}
            />
          </Box>
          <Box m={7}>
            <Typography.DisplayXLarge>
              {intl.formatMessage({ id: 'action__back_up_wallet' })}
            </Typography.DisplayXLarge>
          </Box>
        </Pressable>
        <Pressable
          mt={isVerticalLayout ? 6 : 0}
          ml={isVerticalLayout ? 0 : 6}
          bgColor={isDark ? '#040407' : '#ECEDEE'}
          w={imageBoxWidth}
          h={imageBoxHeight}
          borderColor="border-subdued"
          borderWidth={StyleSheet.hairlineWidth}
          borderRadius="12px"
          onPress={() => {
            navigation.navigate(KeyTagRoutes.ImportKeytag);
          }}
        >
          <Box position="absolute" top="0" right="0" bottom="1">
            <Image
              source={isDark ? keytagDark2 : keytagLight2}
              borderRadius="12px"
              w={imageWidth}
              h={imageHeight}
            />
          </Box>
          <Box m={7}>
            <Typography.DisplayXLarge>
              {intl.formatMessage({ id: 'action__import_wallet' })}
            </Typography.DisplayXLarge>
          </Box>
        </Pressable>
      </Box>
      <Box mt={8} flexDirection="row" justifyContent="center">
        <Pressable
          flexDirection="row"
          justifyContent="center"
          alignItems="center"
          onPress={() => {
            openUrlExternal(keyTagShoppingUrl);
          }}
        >
          <Icon name="ShoppingBagOutline" />
          <Typography.Body1Strong mx={2}>
            {intl.formatMessage({ id: 'action__learn_more_n_purchase' })}
          </Typography.Body1Strong>
          <Icon name="ChevronRightMini" />
        </Pressable>
      </Box>
    </LayoutContainer>
  );
};

export default Started;
