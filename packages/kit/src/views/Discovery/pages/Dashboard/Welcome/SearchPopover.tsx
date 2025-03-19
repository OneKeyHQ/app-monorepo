import type { FC, ReactNode } from 'react';

import { AnimatePresence, Portal, Stack } from '@onekeyhq/components';

export interface ISearchPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export const SearchPopover: FC<ISearchPopoverProps> = ({
  isOpen,
  onOpenChange,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <Portal name="search-popover">
      <AnimatePresence>
        {isOpen ? (
          <Stack
            position="absolute"
            zIndex={999}
            top="100%"
            right={0}
            width="100%"
            marginTop="$2"
            borderRadius="$3"
            backgroundColor="$bg"
            borderWidth={1}
            borderColor="$borderSubdued"
            shadowColor="$shadowColor"
            shadowOffset={{ width: 0, height: 4 }}
            shadowOpacity={0.15}
            shadowRadius={8}
            $gtSm={{ width: 384 }}
            animation="quick"
          >
            {children}
          </Stack>
        ) : null}
      </AnimatePresence>
      {isOpen ? (
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={998}
          onPress={() => onOpenChange(false)}
        />
      ) : null}
    </Portal>
  );
};
