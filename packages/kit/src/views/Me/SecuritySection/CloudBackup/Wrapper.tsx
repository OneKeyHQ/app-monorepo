import type { FC, ReactNode } from 'react';

import { Box, ScrollView, useSafeAreaInsets } from '@onekeyhq/components';

// eslint-disable-next-line @typescript-eslint/ban-types
type WrapperProps = {
  footer?: ReactNode;
};

const defaultProps = {} as const;

const Wrapper: FC<WrapperProps> = ({ children, footer }) => {
  let { bottom } = useSafeAreaInsets();
  bottom = bottom === 0 ? 20 : bottom;

  return (
    <>
      <ScrollView
        alignSelf="stretch"
        flex={1}
        px={4}
        py={{ base: 4, sm: 8 }}
        _contentContainerStyle={{
          w: 'full',
          maxW: 800,
          mx: 'auto',
        }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <Box mx={4} py={4} mb={`${bottom}px`}>
          {footer}
        </Box>
      ) : null}
    </>
  );
};

Wrapper.defaultProps = defaultProps;

export default Wrapper;
