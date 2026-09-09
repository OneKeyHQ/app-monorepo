import { type RefObject, useCallback, useEffect, useRef } from 'react';

import {
  ActionList,
  type IButtonProps,
  ModalNavigatorContext,
  Portal,
  Stack,
  useMedia,
  useModalNavigatorContext,
} from '@onekeyhq/components';
import {
  createImperativeActionListLifecycle,
  preventImperativeActionListCloseAutoFocus,
} from '@onekeyhq/components/src/actions/ActionList/imperativeShowUtils';
import {
  PageContext,
  usePageContext,
} from '@onekeyhq/components/src/layouts/Page/PageContext';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import type { IAccountEditButtonProps } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/AccountEdit/AccountEditButton';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAccountEditActionListOptionsV2 } from './AccountEditActionListV2';

import type {
  NativeListActionAnchor,
  NativeListRef,
} from '@onekeyfe/react-native-native-list';

const desktopMenuPanelPropsV2 = {
  width: '$56',
  onCloseAutoFocus: preventImperativeActionListCloseAutoFocus,
} as const;

export function AccountSelectorMenuActionV2({
  account,
  anchor,
  listRef,
  onClose,
}: {
  account: IAccountEditButtonProps;
  anchor: NativeListActionAnchor;
  listRef: RefObject<NativeListRef | null>;
  onClose: (token: string) => void;
}) {
  const { title, renderItemsAsync, ready } =
    useAccountEditActionListOptionsV2(account);
  const { gtMd } = useMedia();
  const modalNavigatorContext = useModalNavigatorContext();
  const pageContext = usePageContext();
  const contextsRef = useRef({ modalNavigatorContext, pageContext });
  contextsRef.current = { modalNavigatorContext, pageContext };
  const optionsRef = useRef({ title, renderItemsAsync });
  optionsRef.current = { title, renderItemsAsync };
  useEffect(() => {
    if (!ready) return;
    listRef.current?.setActionAnchorState({ token: anchor.token, open: true });
    const handleClose = () => {
      listRef.current?.setActionAnchorState({
        token: anchor.token,
        open: false,
        restoreFocus: true,
      });
      onClose(anchor.token);
    };
    if (platformEnv.isNative || !gtMd) {
      const handle = ActionList.show({
        title: optionsRef.current.title,
        triggerRect: anchor.windowRect,
        renderItemsAsync: (options) =>
          optionsRef.current.renderItemsAsync(options),
        onClose: handleClose,
      });
      return () => handle.close();
    }

    const portalLifecycle: { destroy?: () => void } = {};
    let closeActionList: (() => void) | undefined;
    let closeRequested = false;
    const lifecycle = createImperativeActionListLifecycle({
      onClose: handleClose,
      destroy: () => portalLifecycle.destroy?.(),
    });
    const { windowRect } = anchor;
    // The anchor is the original 24px layout slot, inside the 38px hit target.
    const triggerStyle = {
      position: 'fixed' as const,
      left: windowRect.x,
      top: windowRect.y,
      width: windowRect.width,
      height: windowRect.height,
    };
    const portal = Portal.Render(
      Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
      <ModalNavigatorContext.Provider
        value={contextsRef.current.modalNavigatorContext}
      >
        <PageContext.Provider value={contextsRef.current.pageContext}>
          <Stack pointerEvents="none" style={triggerStyle}>
            <ActionList
              title={optionsRef.current.title}
              defaultOpen
              placement="bottom-end"
              floatingPanelProps={desktopMenuPanelPropsV2}
              onOpenChange={lifecycle.handleOpenChange}
              renderTrigger={
                <Stack
                  width={windowRect.width}
                  height={windowRect.height}
                  pointerEvents="none"
                />
              }
              renderItemsAsync={(options) => {
                closeActionList = options.handleActionListClose;
                if (closeRequested) {
                  closeActionList();
                  return Promise.resolve(null);
                }
                return optionsRef.current.renderItemsAsync(options);
              }}
            />
          </Stack>
        </PageContext.Provider>
      </ModalNavigatorContext.Provider>,
    );
    portalLifecycle.destroy = () => portal.destroy();
    return () => {
      closeRequested = true;
      closeActionList?.();
      lifecycle.close();
    };
  }, [anchor, gtMd, listRef, onClose, ready]);
  return null;
}

function InvokeCreateAddressV2({
  onPress,
  onDone,
}: {
  onPress: NonNullable<IButtonProps['onPress']>;
  onDone: () => void;
}) {
  const invoked = useRef(false);
  useEffect(() => {
    if (invoked.current) return;
    invoked.current = true;
    // AccountSelectorCreateAddressButton supplies a zero-argument async handler.
    const create = onPress as () => Promise<void>;
    void create().finally(onDone);
  }, [onDone, onPress]);
  return null;
}

export function AccountSelectorCreateAddressActionV2({
  num,
  walletId,
  networkId,
  indexedAccountId,
  deriveType,
  onDone,
}: {
  num: number;
  walletId: string;
  networkId?: string;
  indexedAccountId?: string;
  deriveType?: IAccountDeriveTypes;
  onDone: () => void;
}) {
  const renderButton = useCallback(
    (props: IButtonProps) =>
      props.onPress ? (
        <InvokeCreateAddressV2 onPress={props.onPress} onDone={onDone} />
      ) : null,
    [onDone],
  );
  return (
    <AccountSelectorCreateAddressButton
      num={num}
      account={{ walletId, networkId, indexedAccountId, deriveType }}
      selectAfterCreate
      buttonRender={renderButton}
    />
  );
}
