import React, { FC } from 'react';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  Typography,
} from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../hooks/redux';

export type ConfirmHeaderProps = {
  title: string;
  origin?: string;
};

const ConfirmHeader: FC<ConfirmHeaderProps> = (props) => {
  const { title, origin } = props;
  const { account, network } = useActiveWalletAccount();

  const logoURI = origin ? `${origin}/favicon.ico` : '';
  const host = origin?.split('://')[1] ?? 'DApp';

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      mb="8"
      mt="2"
    >
      <Image
        source={{ uri: logoURI }}
        alt="logoURI"
        size="56px"
        borderRadius="full"
        fallbackElement={
          <Center
            w="56px"
            h="56px"
            rounded="full"
            bgColor="surface-neutral-default"
          >
            <Icon size={32} name="QuestionMarkOutline" />
          </Center>
        }
      />

      <Typography.PageHeading mt="4">{title}</Typography.PageHeading>

      <HStack justifyContent="center" alignItems="center" mt="16px">
        <Typography.Body1 mr="18px">{host}</Typography.Body1>
        <Icon size={20} name="SwitchHorizontalSolid" />
        <Image
          src={network?.logoURI}
          ml="18px"
          mr="8px"
          width="16px"
          height="16px"
          borderRadius="full"
        />
        <Typography.Body2>{account?.name}</Typography.Body2>
      </HStack>
    </Box>
  );
};

export default ConfirmHeader;
