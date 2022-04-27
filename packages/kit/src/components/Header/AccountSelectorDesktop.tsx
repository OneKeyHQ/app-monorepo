import React from 'react';

import { useDrawerStatus } from '@react-navigation/drawer';

import {
  Box,
  // OverlayContainer,
  PresenceTransition,
} from '@onekeyhq/components';
import { useDomID } from '@onekeyhq/components/src/hooks/useClickDocumentClose';
// import { useDropdownPosition } from '@onekeyhq/components/src/hooks/useDropdownPosition';
import type { DesktopRef } from '@onekeyhq/components/src/Select/Container/Desktop';

import AccountSelectorChildren from './AccountSelectorChildren';

type ChildDropdownProps = {
  visible: boolean;
  toggleVisible: (...args: any) => any;
  // triggerEle?: HTMLElement | null;
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
    // 因为overlay的使用与modal展示冲突，所以注掉
    // const { position, toPxPositionValue } = useDropdownPosition({
    //   triggerEle,
    //   domId,
    //   visible,
    //   dropdownPosition: 'right',
    //   translateY,
    //   autoAdjust: false,
    //   setPositionOnlyMounted: true,
    // });
    const status = useDrawerStatus();
    const isOpen = status === 'open';
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
      >
        <Box
          nativeID={domId}
          // left={toPxPositionValue(position.left)}
          // right={toPxPositionValue(position.right)}
          // top={toPxPositionValue(position.top)}
          // bottom={toPxPositionValue(position.bottom)}
          right="-138px"
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
          <AccountSelectorChildren isOpen={isOpen} />
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
