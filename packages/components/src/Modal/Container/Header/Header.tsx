import type { FC } from 'react';
import { useMemo } from 'react';

import { StyleSheet } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../../../Box';
import Center from '../../../Center';
import HStack from '../../../HStack';
import IconButton from '../../../IconButton';
import Typography from '../../../Typography';

import NavigationButton from './NavigationButton';

import type { HeaderProps } from './type';

const Header: FC<HeaderProps> = ({
  header,
  closeable,
  headerDescription,
  firstIndex,
  hideBackButton,
  rightContent,
  onPressBackButton,
  onPressCloseButton,
}) => {
  const IOSPhoneHeader = useMemo(
    () => (
      <Box>
        <Center py={1}>
          <Box rounded="full" bgColor="icon-disabled" w={10} h={1} />
        </Center>
        <HStack px={4} py={1}>
          <Box flex={1} h="28px" justifyContent="center" ml="-6px">
            {!firstIndex && !hideBackButton ? (
              <IconButton
                size="lg"
                name="ArrowLeftOutline"
                type="plain"
                circle
                onPress={onPressBackButton}
                alignSelf="flex-start"
              />
            ) : null}
          </Box>
          <Box w="224px">
            <Typography.Heading textAlign="center">{header}</Typography.Heading>
            {headerDescription ? (
              <Box alignItems="center">
                {typeof headerDescription === 'string' ? (
                  <Typography.Caption textAlign="center" color="text-subdued">
                    {headerDescription}
                  </Typography.Caption>
                ) : (
                  headerDescription
                )}
              </Box>
            ) : null}
          </Box>
          <HStack
            h="28px"
            flex={1}
            justifyContent="flex-end"
            alignItems="center"
            mr="-6px"
          >
            {rightContent || null}
          </HStack>
        </HStack>
      </Box>
    ),
    [
      firstIndex,
      header,
      headerDescription,
      hideBackButton,
      onPressBackButton,
      rightContent,
    ],
  );

  const RestHeader = useMemo(
    () => (
      <HStack
        alignItems="center"
        px={{ base: '16px', md: '24px' }}
        h={{ base: '57px', md: '65px' }}
        borderBottomColor="divider"
        borderBottomWidth={header ? StyleSheet.hairlineWidth : undefined}
        space="8px"
      >
        {!firstIndex && !hideBackButton ? (
          <NavigationButton mr="4px" back onPress={onPressBackButton} />
        ) : null}
        <Box flex={1}>
          <Typography.Heading>{header}</Typography.Heading>
          {headerDescription ? (
            <Box>
              {typeof headerDescription === 'string' ? (
                <Typography.Caption color="text-subdued">
                  {headerDescription}
                </Typography.Caption>
              ) : (
                headerDescription
              )}
            </Box>
          ) : null}
        </Box>
        {rightContent ? (
          <HStack alignItems="center">{rightContent}</HStack>
        ) : null}
        {closeable ? <NavigationButton onPress={onPressCloseButton} /> : null}
      </HStack>
    ),
    [
      closeable,
      firstIndex,
      header,
      headerDescription,
      hideBackButton,
      onPressBackButton,
      onPressCloseButton,
      rightContent,
    ],
  );

  if (platformEnv.isNativeIOSPhone) return IOSPhoneHeader;
  return RestHeader;
};

export default Header;
