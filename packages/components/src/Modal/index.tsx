import React, {
  ComponentProps,
  MutableRefObject,
  ReactElement,
  ReactNode,
  cloneElement,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../Box';
import Button from '../Button';
import FlatList from '../FlatList';
import { LocaleIds } from '../locale';
import { useIsVerticalLayout, useUserDevice } from '../Provider/hooks';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import SortableList from '../SortableList';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';

export type ModalProps = {
  /*
    we might change Header to Title in future
  */
  header?: string;
  /*
    we might change headerShown to Header in future
  */
  hideBackButton?: boolean;
  headerShown?: boolean;
  headerDescription?: string | ReactNode;
  trigger?: ReactElement<any>;
  visible?: boolean;
  closeable?: boolean;
  closeAction?: () => void;
  closeOnOverlayClick?: boolean;
  primaryActionTranslationId?: LocaleIds;
  secondaryActionTranslationId?: LocaleIds;
  onBackActionPress?: () => void;
  onPrimaryActionPress?: ({
    onClose,
    close,
  }: {
    onClose?: () => void; // TODO remove
    close: () => void;
  }) => void;
  onSecondaryActionPress?: ({ close }: { close: () => void }) => void;
  hidePrimaryAction?: boolean;
  hideSecondaryAction?: boolean;
  primaryActionProps?: ComponentProps<typeof Button>;
  secondaryActionProps?: ComponentProps<typeof Button>;
  footer?: ReactNode;
  // TODO remove, use `onModalClose` if you need modal closed event
  onClose?: () => void | boolean;
  onModalClose?: () => void | boolean;
  onVisibleChange?: (v: boolean) => void;
  scrollViewProps?: ComponentProps<typeof ScrollView>;
  flatListProps?: ComponentProps<typeof FlatList>;
  sectionListProps?: ComponentProps<typeof SectionList>;
  sortableListProps?: ComponentProps<typeof SortableList.Container>;
  staticChildrenProps?: ComponentProps<typeof Box>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  height?: number | string;
  /*
    maxHeight work for Desktop Modal
  */
  maxHeight?: number | string;
  modalHeight?: string | number | 'full';

  children?: ReactNode;
};

const defaultProps = {
  closeable: true,
  size: 'xs',
  height: 'auto',
  maxHeight: '90%',
  modalHeight: 'full',
  headerShown: true,
  closeOnOverlayClick: true,
} as const;

// used for Select in Modal
// do not delete
export const ModalRefStore: {
  ref: MutableRefObject<null>;
} = {
  ref: {
    current: null,
  },
};

/* eslint-disable react/prop-types */
const Modal = ({
  trigger,
  visible: outerVisible,
  onClose,
  onModalClose,
  sectionListProps,
  flatListProps,
  scrollViewProps,
  staticChildrenProps,
  sortableListProps,
  header,
  headerShown,
  modalHeight,
  ...rest
}: ModalProps) => {
  const { size } = useUserDevice();
  const modalRef = useRef(null);

  useEffect(() => {
    ModalRefStore.ref = modalRef;
  }, [modalRef]);

  const isVerticalLayout = useIsVerticalLayout();

  const modalContent = useMemo(() => {
    let content = (
      <Box
        // eslint-disable-next-line no-nested-ternary
        pt={headerShown ? (header ? 6 : 0) : 6}
        pb={6}
        px={{ base: 4, md: 6 }}
        flex="1"
      >
        {rest.children}
      </Box>
    );
    if (sectionListProps) {
      content = (
        <SectionList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: 24,
            // eslint-disable-next-line no-nested-ternary
            paddingTop: headerShown ? (header ? 24 : 0) : 24,
          }}
          px={{ base: 4, md: 6 }}
          {...sectionListProps}
        />
      );
    } else if (flatListProps) {
      content = (
        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: 24,
            // eslint-disable-next-line no-nested-ternary
            paddingTop: headerShown ? (header ? 24 : 0) : 24,
          }}
          px={{ base: 4, md: 6 }}
          {...flatListProps}
        />
      );
    } else if (scrollViewProps) {
      content = (
        <ScrollView
          testID="Modal-ScrollView-Container"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: 24,
            // eslint-disable-next-line no-nested-ternary
            paddingTop: headerShown ? (header ? 24 : 0) : 24,
          }}
          px={{ base: 4, md: 6 }}
          {...scrollViewProps}
        />
      );
    } else if (sortableListProps) {
      content = (
        <Box flex="1">
          <Box h="full">
            <SortableList.Container
              style={{ height: '100%' }}
              containerStyle={{ height: '100%' }}
              contentContainerStyle={{
                paddingBottom: 24,
                paddingTop: 24,
              }}
              {...sortableListProps}
            />
          </Box>
        </Box>
      );
    } else if (staticChildrenProps) {
      content = <Box {...staticChildrenProps}>{rest.children}</Box>;
    }

    return content;
  }, [
    sectionListProps,
    flatListProps,
    scrollViewProps,
    staticChildrenProps,
    sortableListProps,
    rest.children,
    header,
    headerShown,
  ]);

  const modalContainer = useMemo(() => {
    /*
      Why `platformEnv.isNativeIOS` ?
      We want to use the native modal component in iPad which screen width might bigger then NORMAL breakpoint
    */
    const isSmallScreen = ['SMALL', 'NORMAL'].includes(size);
    if (isSmallScreen || platformEnv.isNativeIOS) {
      return (
        <Box flex={1} alignItems="flex-end" w="100%" flexDirection="row">
          <Box
            ref={modalRef}
            height={modalHeight}
            // TODO 100vh in App
            maxHeight={platformEnv.isRuntimeBrowser ? '100vh' : undefined}
            w="100%"
            borderBottomRadius={isSmallScreen ? 0 : '24px'}
            borderTopRadius={
              platformEnv.isExtensionUiStandaloneWindow ||
              platformEnv.isNativeAndroid ||
              ((platformEnv.isWeb || platformEnv.isExtension) &&
                isVerticalLayout)
                ? 0
                : '24px'
            }
            overflow="hidden"
          >
            <Mobile
              onClose={onModalClose}
              headerShown={headerShown}
              header={header}
              {...rest}
            >
              {modalContent}
            </Mobile>
          </Box>
        </Box>
      );
    }

    return (
      <Desktop
        onClose={onModalClose}
        headerShown={headerShown}
        header={header}
        {...rest}
      >
        {modalContent}
      </Desktop>
    );
  }, [
    isVerticalLayout,
    size,
    onModalClose,
    headerShown,
    header,
    rest,
    modalContent,
    modalHeight,
  ]);

  const triggerNode = useMemo(() => {
    if (!trigger) return null;
    return cloneElement(trigger, {
      /* eslint @typescript-eslint/no-unsafe-member-access: "off" */
      onPress: trigger.props.onPress,
    });
  }, [trigger]);

  const node = (
    <>
      {triggerNode}
      {modalContainer}
    </>
  );

  return node;
};

Modal.displayName = 'Modal';

Modal.defaultProps = defaultProps;

export default Modal;
