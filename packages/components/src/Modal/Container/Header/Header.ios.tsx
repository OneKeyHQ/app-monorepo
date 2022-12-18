import type { FC } from 'react';

import Box from '../../../Box';
import Center from '../../../Center';
import HStack from '../../../HStack';
import IconButton from '../../../IconButton';
import Typography from '../../../Typography';

import type { HeaderProps } from './type';

const Header: FC<HeaderProps> = ({
  header,
  headerDescription,
  firstIndex,
  hideBackButton,
  rightContent,
  onPressBackButton,
}) => (
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
);

export default Header;
