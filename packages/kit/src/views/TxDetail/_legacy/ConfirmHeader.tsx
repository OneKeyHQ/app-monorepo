import React, { FC } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  Typography,
} from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../../hooks/redux';

export type ConfirmHeaderProps = {
  title: string;
  origin?: string;
};

const ConfirmHeader: FC<ConfirmHeaderProps> = (props) => {
  const { title, origin } = props;
  const { account, network } = useActiveWalletAccount();
  const intl = useIntl();

  const logoURI = origin ? `${origin}/favicon.ico` : '';
  const host = origin?.split('://')[1] ?? 'DApp';

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      mt="2"
    >
      <Image
        source={{ uri: logoURI }}
        alt="logoURI"
        size="40px"
        borderRadius="full"
        fallbackElement={
          <Center
            w="40px"
            h="40px"
            rounded="full"
            bgColor="surface-neutral-default"
          >
            <Icon size={24} name="QuestionMarkOutline" />
          </Center>
        }
      />

      <Typography.DisplayXLarge mt="4">{title}</Typography.DisplayXLarge>
      <Typography.Body1 mt={1} color="text-subdued">
        {host}
      </Typography.Body1>

      <HStack
        alignItems="center"
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderColor="border-subdued"
        mt="32px"
        alignSelf="stretch"
        px="16px"
        pb="12px"
      >
        <Typography.Body1Strong color="text-subdued" flex={1}>
          {intl.formatMessage({ id: 'form__account' })}
        </Typography.Body1Strong>
        <HStack alignItems="center">
          <Image src={network?.logoURI} size="24px" borderRadius="full" />
          <Typography.Body1 ml="12px">{account?.name}</Typography.Body1>
        </HStack>
      </HStack>
    </Box>
  );
};

export default ConfirmHeader;
