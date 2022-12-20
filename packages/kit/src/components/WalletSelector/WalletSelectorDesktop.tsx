import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import {
  Box,
  OverlayContainer,
  PresenceTransition,
} from '@onekeyhq/components';
import { useDomID } from '@onekeyhq/components/src/hooks/useClickDocumentClose';
import { CloseBackDrop } from '@onekeyhq/components/src/Select';
import type { DesktopRef } from '@onekeyhq/components/src/Select/Container/Desktop';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WalletSelectorChildren from './WalletSelectorChildren';

type ChildDropdownProps = {
  visible: boolean;
  toggleVisible: (...args: any) => any;
};

const WalletSelectorDesktop = forwardRef<DesktopRef, ChildDropdownProps>(
  ({ visible, toggleVisible }, ref) => {
    const translateY = 12;
    const isBrowser = platformEnv.isRuntimeBrowser;
    const { domId } = useDomID('AccountSelectorDesktop');
    useImperativeHandle(ref, () => ({
      toggleVisible,
      getVisible: () => visible,
      domId,
    }));

    useEffect(() => {
      debugLogger.accountSelector.info('WalletSelectorDesktop mount');
      return () => {
        debugLogger.accountSelector.info('WalletSelectorDesktop unmounted');
      };
    }, []);

    const accountSelectorChildren = useMemo(
      () => (
        <Box
          marginTop="4px"
          nativeID={domId}
          left={isBrowser ? 0 : '16px'}
          top={isBrowser ? -8 : '52px'}
          position="absolute"
          width="320px"
          height="564px"
          borderRadius="xl"
          bg="background-default"
          borderColor="border-subdued"
          borderWidth="1px"
          flexDirection="row"
          shadow="depth.3"
        >
          <WalletSelectorChildren
          // isOpen={visible}
          // toggleOpen={toggleVisible}
          />
        </Box>
      ),
      [domId, isBrowser],
    );

    const accountSelectorChildrenRef = useRef<JSX.Element | undefined>();
    accountSelectorChildrenRef.current = accountSelectorChildren;

    if (!visible) {
      // return null;
    }

    const content = (
      <>
        {visible && <CloseBackDrop onClose={toggleVisible} />}
        {/* <Box display={visible ? 'block' : 'none'}> */}
        {/*  {accountSelectorChildren} */}
        {/* </Box> */}
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
          style={{ width: visible ? '100%' : 0 }}
        >
          {accountSelectorChildrenRef.current}
        </PresenceTransition>
      </>
    );
    if (isBrowser) {
      return content;
    }
    return <OverlayContainer>{content}</OverlayContainer>;
  },
);

WalletSelectorDesktop.displayName = 'WalletSelectorDesktop';

export default memo(WalletSelectorDesktop);
