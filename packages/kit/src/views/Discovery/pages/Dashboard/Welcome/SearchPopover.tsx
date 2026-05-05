import type { FC, ReactNode } from 'react';

import { Portal, Stack } from '@onekeyhq/components';
import type { IStackProps } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';

export interface ISearchPopoverProps {
  isOpen: boolean;
  children: ReactNode;
  containerProps?: Partial<IStackProps>;
}

export const SearchPopover: FC<ISearchPopoverProps> = ({
  isOpen,
  children,
  containerProps,
}) => (
  <Portal name="search-popover">
    {isOpen ? (
      <Stack
        position="absolute"
        zIndex={999}
        top="100%"
        right={0}
        width="100%"
        marginTop="$2"
        animation="quick"
        animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
        enterStyle={{
          opacity: 0,
          scale: 0.96,
        }}
        exitStyle={{
          opacity: 0,
          scale: 0.96,
        }}
        opacity={1}
        scale={1}
        {...containerProps}
      >
        <Stack
          borderRadius="$3"
          backgroundColor="$bg"
          borderWidth={1}
          borderColor="$borderSubdued"
          shadowColor="$popoverShadowColor"
          shadowOffset={{ width: 0, height: 4 }}
          shadowOpacity={0.05}
          shadowRadius={8}
        >
          {children}
        </Stack>
      </Stack>
    ) : null}
  </Portal>
);
