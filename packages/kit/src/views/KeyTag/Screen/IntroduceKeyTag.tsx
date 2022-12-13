import { ReactElement, useMemo } from 'react';

import { StackNavigationProp } from '@react-navigation/stack';

import {
  Box,
  Button,
  Image,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import iconNFCScanHint from '@onekeyhq/kit/assets/hardware/ic_pair_hint_scan_lite.png';

import { useNavigation } from '../../../hooks';
import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagRoutes } from '../Routes/enums';
import { IKeytagRoutesParams } from '../Routes/types';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const Introduce = () => {
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const components = useMemo(() => {
    const res: { image?: ReactElement; detail?: ReactElement } = {};
    res.image = (
      <Box flex="1">
        <Image source={iconNFCScanHint} />
      </Box>
    );
    res.detail = (
      <Box flex="1">
        <Typography.DisplayLarge>
          Like a Dot-Punching Game, Record Your Recovery Phrase
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
          mt={3}
        >
          Get started
        </Button>
      </Box>
    );
    return res;
  }, []);
  return (
    <LayoutContainer backButton>
      <Box flex="1" flexDirection={isVertical ? 'column' : 'row'}>
        {isVertical ? (
          <>
            {components.image}
            {components.detail}
          </>
        ) : (
          <>
            {components.detail}
            {components.image}
          </>
        )}
      </Box>
    </LayoutContainer>
  );
};

export default Introduce;
