import { FC, useCallback } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { StackNavigationProp } from '@react-navigation/stack';

import {
  Box,
  Button,
  Center,
  Icon,
  ScrollView,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagMatrix } from '../Component/KeyTagMatrix/KeyTagMatrix';
import { KeyTagRoutes } from '../Routes/enums';
import { IKeytagRoutesParams } from '../Routes/types';
import { mnemonicWordsToKeyTagMnemonic } from '../utils';

type RouteProps = RouteProp<IKeytagRoutesParams, KeyTagRoutes.ShowDotMap>;
type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const RightDoneBtn = ({ onDone }: { onDone?: () => void }) => (
  <Button mr={2} type="primary" size="sm" onPress={onDone}>
    Done
  </Button>
);

const TopMidCompoment = () => {
  console.log('TopMidCompoment');
  return (
    <Center flexDirection="row" alignItems="center">
      <Box mr={2}>
        <Icon name="WalletOutline" />
      </Box>
      <Box flexDirection="column">
        <Typography.Body1Strong>Wallet #1</Typography.Body1Strong>
        <Typography.Caption>24 words</Typography.Caption>
      </Box>
    </Center>
  );
};

const ShowDotMap: FC = () => {
  const route = useRoute<RouteProps>();
  const { mnemonic } = route.params;
  const keyTagData = mnemonicWordsToKeyTagMnemonic(mnemonic);
  const navigation = useNavigation<NavigationProps>();
  const isVertical = useIsVerticalLayout();
  navigation.setOptions({
    headerShown: true,
    headerTitleAlign: 'center',
    headerRight: () => <RightDoneBtn />,
    headerTitle: () => <TopMidCompoment />,
  });
  return (
    <LayoutContainer backButton={false}>
      <Box flex="1">
        <ScrollView>
          <Box flexDirection={isVertical ? 'column' : 'row'}>
            {keyTagData?.length && keyTagData.length > 12 ? (
              <>
                <KeyTagMatrix keyTagData={keyTagData.slice(0, 12)} />
                <KeyTagMatrix keyTagData={keyTagData.slice(12)} />
              </>
            ) : (
              <KeyTagMatrix keyTagData={keyTagData} />
            )}
          </Box>
        </ScrollView>
      </Box>
    </LayoutContainer>
  );
};

export default ShowDotMap;
