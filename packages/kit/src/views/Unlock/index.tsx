import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  Icon,
  IconButton,
  Typography,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TabRoutes, TabRoutesParams } from '../../routes/Stack';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  TabRoutesParams,
  TabRoutes.Home
>;

const UnlockButton = () => {
  const intl = useIntl();
  return platformEnv.isExtension ? (
    <Button leftIconName="ArrowNarrowLeftSolid">
      {intl.formatMessage({ id: 'action__forget_password' })}
    </Button>
  ) : (
    <IconButton name="FaceIdOutline" iconSize={24} />
  );
};

const Unlock = () => {
  const intl = useIntl();
  const { control } = useForm();
  const navigation = useNavigation<NavigationProps>();
  const isSmall = useIsVerticalLayout();
  const justifyContent = isSmall ? 'space-between' : 'center';
  const py = isSmall ? '16' : undefined;
  const onUnlock = useCallback(() => {
    navigation.navigate(TabRoutes.Home);
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
        {isSmall ? <UnlockButton /> : undefined}
      </Box>
    </Center>
  );
};

export default Unlock;
