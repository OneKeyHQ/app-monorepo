import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  ScrollView,
  Typography,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';

type LayoutProps = {
  onNew?: () => void;
};

const MobileLayout: FC<LayoutProps> = ({ children, onNew }) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  return (
    <Box w="full" h="full" bg="background-default">
      <ScrollView flex="1" p="4">
        {children}
      </ScrollView>
      <Box
        px="4"
        pt="4"
        pb={`${bottom + 16}px`}
        borderTopWidth="0.5"
        borderColor="border-subdued"
        bg="surface-subdued"
      >
        <Button leftIconName="PlusMini" onPress={onNew} size="xl">
          {intl.formatMessage({ id: 'action__add_new_address' })}
        </Button>
      </Box>
    </Box>
  );
};

const LaptopLayout: FC<LayoutProps> = ({ children, onNew }) => {
  const intl = useIntl();
  return (
    <Box
      width="full"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Box maxW="768px" width="full">
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          my="7"
        >
          <Typography.DisplayXLarge>
            {intl.formatMessage({ id: 'title__address_book' })}
          </Typography.DisplayXLarge>
          <Button leftIconName="PlusMini" onPress={onNew}>
            {intl.formatMessage({ id: 'action__add_new_address' })}
          </Button>
        </Box>
        <Box width="full">{children}</Box>
      </Box>
    </Box>
  );
};

const Layout: FC<LayoutProps> = ({ children, onNew }) => {
  const isVertical = useIsVerticalLayout();
  return isVertical ? (
    <MobileLayout onNew={onNew}>{children}</MobileLayout>
  ) : (
    <LaptopLayout onNew={onNew}>{children}</LaptopLayout>
  );
};

export default Layout;
