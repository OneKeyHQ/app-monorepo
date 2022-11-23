import { FC, useCallback } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import {
  Box,
  Button,
  Icon,
  ScrollView,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { HomeRoutes } from '../../../routes/routesEnum';
import { HomeRoutesParams, TabRoutesParams } from '../../../routes/types';
import { KeyTagMatrix } from '../Component/KeyTagMatrix/KeyTagMatrix';
import { mnemonicWordsToKeyTagMnemonic } from '../utils';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.ShowDotMap>;
type NavigationProps = NativeStackNavigationProp<TabRoutesParams>;

const RightDoneBtn = ({ onDone }: { onDone?: () => void }) => (
  <Button mr={2} type="primary" size="sm" onPress={onDone}>
    Done
  </Button>
);

const TopMidCompoment = () => {
  console.log('TopMidCompoment');
  return (
    <Box flexDirection="row">
      <Box mr={2}>
        <Icon name="WalletOutline" />
      </Box>
      <Box flexDirection="column">
        <Typography.Body1Strong>Wallet #1</Typography.Body1Strong>
        <Typography.Caption>24 words</Typography.Caption>
      </Box>
    </Box>
  );
};

const ShowDotMap: FC = () => {
  const route = useRoute<RouteProps>();
  const { mnemonicWords } = route.params;
  const keyTagData = mnemonicWordsToKeyTagMnemonic(mnemonicWords);
  const navigation = useNavigation<NavigationProps>();
  const isVertical = useIsVerticalLayout();
  navigation.setOptions({
    headerRight: () => <RightDoneBtn />,
    headerTitle: () => <TopMidCompoment />,
  });
  return (
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
  );
};

export default ShowDotMap;
