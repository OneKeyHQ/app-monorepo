import React from 'react';

import { Box, PresenceTransition } from '@onekeyhq/components';
import { useDomID } from '@onekeyhq/components/src/hooks/useClickDocumentClose';
import type { DesktopRef } from '@onekeyhq/components/src/Select/Container/Desktop';

import AccountSelectorChildren from './AccountSelectorChildren';

type ChildDropdownProps = {
  visible: boolean;
  toggleVisible: (...args: any) => any;
};

const AccountSelectorDesktop = React.forwardRef<DesktopRef, ChildDropdownProps>(
  ({ visible, toggleVisible }, ref) => {
    const translateY = 12;
    const { domId } = useDomID('AccountSelectorDesktop');
    React.useImperativeHandle(ref, () => ({
      toggleVisible,
      getVisible: () => visible,
      domId,
    }));

    const content = (
      <PresenceTransition
        visible={visible}
        initial={{ opacity: 0, translateY: 0 }}
        animate={{
          opacity: 1,
          translateY,
          transition: {
            duration: 150,
          },
        }}
        style={{ width: '100%' }}
      >
        <Box
          nativeID={domId}
          right="0px"
          position="absolute"
          width="320px"
          height="564px"
          borderRadius="xl"
          bg="surface-subdued"
          borderColor="border-subdued"
          borderWidth="1px"
          flexDirection="row"
          shadow="depth.3"
        >
          <AccountSelectorChildren />
        </Box>
      </PresenceTransition>
    );
    return content;
    //    Error: Couldn't find a drawer. Is your component inside a drawer navigator?
    // return <OverlayContainer>{content}</OverlayContainer>;
  },
);

AccountSelectorDesktop.displayName = 'AccountSelectorDesktop';

export default AccountSelectorDesktop;
