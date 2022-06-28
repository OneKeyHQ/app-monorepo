import React from 'react';

import {
  Box,
  OverlayContainer,
  PresenceTransition,
} from '@onekeyhq/components';
import { useDomID } from '@onekeyhq/components/src/hooks/useClickDocumentClose';
import { CloseButton } from '@onekeyhq/components/src/Select';
import type { DesktopRef } from '@onekeyhq/components/src/Select/Container/Desktop';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import AccountSelectorChildren from './AccountSelectorChildren';

type ChildDropdownProps = {
  visible: boolean;
  toggleVisible: (...args: any) => any;
};

const AccountSelectorDesktop = React.forwardRef<DesktopRef, ChildDropdownProps>(
  ({ visible, toggleVisible }, ref) => {
    const translateY = 12;
    const isBrowser = platformEnv.isRuntimeBrowser;
    const { domId } = useDomID('AccountSelectorDesktop');
    React.useImperativeHandle(ref, () => ({
      toggleVisible,
      getVisible: () => visible,
      domId,
    }));

    if (!visible) {
      return null;
    }

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
          marginTop="4px"
          nativeID={domId}
          left={isBrowser ? 0 : '16px'}
          top={isBrowser ? -8 : '52px'}
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
          <AccountSelectorChildren
            isOpen={visible}
            toggleOpen={toggleVisible}
          />
        </Box>
      </PresenceTransition>
    );
    if (isBrowser) {
      return (
        <>
          <CloseButton onClose={toggleVisible} />
          {content}
        </>
      );
    }
    return (
      <OverlayContainer>
        <CloseButton onClose={toggleVisible} />
        {content}
      </OverlayContainer>
    );
  },
);

AccountSelectorDesktop.displayName = 'AccountSelectorDesktop';

export default AccountSelectorDesktop;
