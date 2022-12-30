import type { FC } from 'react';
import { useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletAvatarPro } from '../../../components/WalletSelector/WalletAvatar';
import { RootRoutes, TabRoutes } from '../../../routes/routesEnum';
import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagMatrix } from '../Component/KeyTagMatrix/KeyTagMatrix';
import { mnemonicWordsToKeyTagMnemonic } from '../utils';

import type { KeyTagRoutes } from '../Routes/enums';
import type { IKeytagRoutesParams } from '../Routes/types';
import type { RouteProp } from '@react-navigation/core';
import type { StackNavigationProp } from '@react-navigation/stack';

type RouteProps = RouteProp<IKeytagRoutesParams, KeyTagRoutes.ShowDotMap>;
type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const RightDoneBtn = ({
  onDone,
  message,
}: {
  onDone?: () => void;
  message?: string;
}) => (
  <Button mr={2} type="primary" size="sm" onPress={onDone}>
    {message ?? 'Done'}
  </Button>
);

const TopMidCompoment = ({
  mnemonic,
  wallet,
}: {
  mnemonic: string;
  wallet?: IWallet;
}) => {
  const intl = useIntl();
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
        <Typography.Caption>{`${intl.formatMessage(
          { id: 'form__str_words' },
          { 0: mnemonicCounts },
        )}`}</Typography.Caption>
      </Box>
    </Center>
  );
};

const ShowDotMap: FC = () => {
  const route = useRoute<RouteProps>();
  const { mnemonic, wallet } = route.params;
  const intl = useIntl();
  const keyTagData = mnemonicWordsToKeyTagMnemonic(mnemonic);
  const navigation = useNavigation<NavigationProps>();
  const isVertical = useIsVerticalLayout();
  const rightDoneBtn = useMemo(
    () => (
      <RightDoneBtn
        message={intl.formatMessage({ id: 'action__done' })}
        onDone={() => {
          navigation
            .getParent()
            ?.navigate(RootRoutes.Tab, { screen: TabRoutes.Home });
        }}
      />
    ),
    [intl, navigation],
  );
  const titleHeader = useMemo(
    () => <TopMidCompoment mnemonic={mnemonic} wallet={wallet} />,
    [mnemonic, wallet],
  );
  const LeftButton = useMemo(
    () =>
      !platformEnv.isNativeAndroid ? (
        <Button
          type="plain"
          leftIconName="ChevronLeftOutline"
          onPress={() => {
            if (navigation?.canGoBack?.()) {
              navigation.goBack();
            }
          }}
        />
      ) : null,
    [navigation],
  );
  navigation.setOptions({
    headerShown: true,
    headerTitleAlign: 'center',
    headerLeft: () => LeftButton,
    headerRight: () => rightDoneBtn,
    headerTitle: () => titleHeader,
    headerShadowVisible: false,
  });
  return (
    <LayoutContainer backButton={false}>
      <Box flex="1">
        <Box flexDirection={isVertical ? 'column' : 'row'}>
          {keyTagData?.length && keyTagData.length > 12 ? (
            <>
              <KeyTagMatrix keyTagData={keyTagData.slice(0, 12)} />
              <KeyTagMatrix keyTagData={keyTagData.slice(12)} startIndex={13} />
            </>
          ) : (
            <KeyTagMatrix keyTagData={keyTagData} />
          )}
        </Box>
      </Box>
    </LayoutContainer>
  );
};

export default ShowDotMap;
