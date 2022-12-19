import { FC, useCallback, useMemo } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { StackNavigationProp } from '@react-navigation/stack';

import {
  Box,
  Button,
  Center,
  Icon,
  Image,
  ScrollView,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagMatrix } from '../Component/KeyTagMatrix/KeyTagMatrix';
import { KeyTagRoutes } from '../Routes/enums';
import { IKeytagRoutesParams } from '../Routes/types';
import { mnemonicWordsToKeyTagMnemonic } from '../utils';
import { Avatar } from '@onekeyhq/shared/src/emojiUtils';
import { IWallet } from '@onekeyhq/engine/src/types';
import { WalletAvatarPro } from '../../../components/WalletSelector/WalletAvatar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { RootRoutes, TabRoutes } from '../../../routes/routesEnum';

type RouteProps = RouteProp<IKeytagRoutesParams, KeyTagRoutes.ShowDotMap>;
type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const RightDoneBtn = ({ onDone }: { onDone?: () => void }) => (
  <Button mr={2} type="primary" size="sm" onPress={onDone}>
    Done
  </Button>
);

const TopMidCompoment = ({
  mnemonic,
  wallet,
}: {
  mnemonic: string;
  wallet?: IWallet;
}) => {
  const mnemonicCounts = useMemo(() => mnemonic.split(' ').length, [mnemonic]);
  return (
    <Center flexDirection="row" alignItems="center">
      {wallet ? (
        <WalletAvatarPro
          size={platformEnv.isNative ? 'lg' : 'sm'}
          wallet={wallet}
          deviceStatus={undefined}
        />
      ) : null}
      <Box ml={wallet ? 3 : 0} flexDirection="column">
        {wallet ? (
          <Typography.Body1Strong>{wallet.name}</Typography.Body1Strong>
        ) : null}
        <Typography.Caption>
          {`${mnemonicCounts} words`} words
        </Typography.Caption>
      </Box>
    </Center>
  );
};

const ShowDotMap: FC = () => {
  const route = useRoute<RouteProps>();
  const { mnemonic, wallet } = route.params;
  const keyTagData = mnemonicWordsToKeyTagMnemonic(mnemonic);
  const navigation = useNavigation<NavigationProps>();
  const isVertical = useIsVerticalLayout();
  navigation.setOptions({
    headerShown: true,
    headerTitleAlign: 'center',
    headerRight: () => (
      <RightDoneBtn
        onDone={() => {
          navigation
            .getParent()
            ?.navigate(RootRoutes.Tab, { screen: TabRoutes.Home });
        }}
      />
    ),
    headerTitle: () => <TopMidCompoment mnemonic={mnemonic} wallet={wallet} />,
  });
  return (
    <LayoutContainer backButton={false}>
      <Box flex="1">
        <ScrollView>
          <Box flexDirection={isVertical ? 'column' : 'row'}>
            {keyTagData?.length && keyTagData.length > 12 ? (
              <>
                <KeyTagMatrix keyTagData={keyTagData.slice(0, 12)} />
                <KeyTagMatrix
                  keyTagData={keyTagData.slice(12)}
                  startIndex={13}
                />
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
