import React, { FC, useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  Icon,
  Typography,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import LocalAuthenticationButton from '../../components/LocalAuthenticationButton';
// import { TabRoutes, TabRoutesParams } from '../../routes/Stack';

// import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// type NavigationProps = NativeStackNavigationProp<
//   TabRoutesParams,
//   TabRoutes.Home
// >;

type UnlockButtonProps = { onUnlock?: () => void; onForget?: () => void };

const UnlockButton: FC<UnlockButtonProps> = ({ onUnlock, onForget }) => {
  const intl = useIntl();
  return platformEnv.isExtension ? (
    <Button leftIconName="ArrowNarrowLeftSolid" onPress={onForget}>
      {intl.formatMessage({ id: 'action__forget_password' })}
    </Button>
  ) : (
    <LocalAuthenticationButton onOk={onUnlock} />
  );
};

const Unlock = () => {
  const intl = useIntl();
  const { control } = useForm();
  const navigation = useNavigation<any>();
  const isSmall = useIsVerticalLayout();
  const justifyContent = isSmall ? 'space-between' : 'center';
  const py = isSmall ? '16' : undefined;
  const onUnlock = useCallback(() => {
    // navigation.navigate(TabRoutes.Home);
  }, [navigation]);
  return (
    <Center w="full" h="full" bg="background-default">
      <Box
        maxW="96"
        p="8"
        w="full"
        h="full"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={justifyContent}
      >
        <Box width="full" py={py}>
          <Box display="flex" flexDirection="column" alignItems="center">
            <Icon name="BrandLogoIllus" size={50} />
            <Typography.DisplayXLarge my="2">OneKey</Typography.DisplayXLarge>
            <Typography.Body1 color="text-subdued">
              {intl.formatMessage({
                id: 'content__the_decentralized_web_awaits',
                defaultMessage: 'The decentralized web awaits',
              })}
            </Typography.Body1>
          </Box>
          <Form mt="8">
            <Form.Item
              control={control}
              name="Password"
              label={intl.formatMessage({
                id: 'form__password',
                defaultMessage: 'Password',
              })}
            >
              <Form.PasswordInput />
            </Form.Item>
            <Button size="xl" onPress={onUnlock}>
              {intl.formatMessage({
                id: 'action__unlock',
                defaultMessage: 'Unlock',
              })}
            </Button>
          </Form>
        </Box>
        {isSmall ? <UnlockButton onUnlock={onUnlock} /> : undefined}
      </Box>
    </Center>
  );
};

export default Unlock;
