import type { ReactElement } from 'react';
import { useMemo } from 'react';

import {
  Box,
  Button,
  Image,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import introductionImage from '@onekeyhq/kit/assets/keytag/introduction@2x.png';

import { useNavigation } from '../../../hooks';
import LayoutContainer from '../../Onboarding/Layout';
import { useIntroductionBigImage } from '../hooks/useKeyTagLayout';
import { KeyTagRoutes } from '../Routes/enums';

import type { IKeytagRoutesParams } from '../Routes/types';
import type { StackNavigationProp } from '@react-navigation/stack';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const Introduce = () => {
  const isVertical = useIsVerticalLayout();
  const { imageHeight, imageWidth, marginT } = useIntroductionBigImage();

  const navigation = useNavigation<NavigationProps>();
  const components = useMemo(() => {
    const res: { image?: ReactElement; detail?: ReactElement } = {};
    res.image = (
      <Box flexDirection="column" alignItems="center">
        <Image
          w={imageWidth}
          h={imageHeight}
          marginTop={marginT}
          resizeMode="contain"
          source={introductionImage}
        />
      </Box>
    );
    res.detail = (
      <Box h="250px">
        <Typography.DisplayLarge
          fontSize="24px"
          fontWeight={700}
          numberOfLines={2}
        >
          Let's Play the Dot-Punching Game
        </Typography.DisplayLarge>
        <Typography.Body1 mt={2}>
          OneKey converts your KeyTag's recovery phrase to BIP39 dot map. Follow
          the dot map and center punch the dots. Enjoy!
        </Typography.Body1>
        <Button
          type="primary"
          onPress={() => {
            navigation.navigate(KeyTagRoutes.KeyTagBackUpWallet);
          }}
          mt={6}
        >
          Get started
        </Button>
      </Box>
    );
    return res;
  }, [imageHeight, imageWidth, marginT, navigation]);
  return (
    <LayoutContainer backButton>
      <Box flexDirection={isVertical ? 'column' : 'row'}>
        {isVertical ? (
          <>
            {components.image}
            {components.detail}
          </>
        ) : (
          <>
            <Box flex={1}>{components.detail}</Box>
            <Box flex={1} px={15}>
              {components.image}
            </Box>
          </>
        )}
      </Box>
    </LayoutContainer>
  );
};

export default Introduce;
