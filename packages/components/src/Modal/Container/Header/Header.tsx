import { FC } from 'react';

import { StyleSheet } from 'react-native';

import Box from '../../../Box';
import HStack from '../../../HStack';
import Typography from '../../../Typography';

import NavigationButton from './NavigationButton';
import { HeaderProps } from './type';

const Header: FC<HeaderProps> = ({
  header,
  closeable,
  headerDescription,
  firstIndex,
  hideBackButton,
  rightContent,
  onPressBackButton,
  onPressCloseButton,
}) => (
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
    {rightContent ? <HStack alignItems="center">{rightContent}</HStack> : null}
    {closeable ? <NavigationButton onPress={onPressCloseButton} /> : null}
  </HStack>
);

export default Header;
