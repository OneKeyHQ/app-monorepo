import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Image,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import introductionImage from '@onekeyhq/kit/assets/keytag/introduction.png';

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
  const intl = useIntl();
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
      <Box>
        <Typography.DisplayLarge
          fontSize="24px"
          fontWeight={700}
          numberOfLines={2}
        >
          {intl.formatMessage({
            id: 'title__lets_play_the_dot_punching_game',
          })}
        </Typography.DisplayLarge>
        <Typography.Body1 mt={2}>
          {intl.formatMessage({
            id: 'title__lets_play_the_dot_punching_game_desc',
          })}
        </Typography.Body1>
        <Button
          type="primary"
          size="xl"
          onPress={() => {
            navigation.navigate(KeyTagRoutes.KeyTagBackUpWallet);
          }}
          mt={6}
        >
          {intl.formatMessage({ id: 'action__get_started' })}
        </Button>
      </Box>
    );
    return res;
  }, [imageHeight, imageWidth, intl, marginT, navigation]);
  return (
    <LayoutContainer backButton>
      <Box flexDirection={isVertical ? 'column-reverse' : 'row'}>
        {isVertical ? (
          <>
            {components.detail}
            {components.image}
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
