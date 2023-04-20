import type {
  ComponentProps,
  MutableRefObject,
  ReactElement,
  ReactNode,
} from 'react';
import { cloneElement, useCallback, useMemo, useRef } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import { useIsVerticalLayout, useUserDevice } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../Box';
import FlatList from '../FlatList';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import SortableList from '../SortableList';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';

import type Button from '../Button';
import type { FlatListProps } from '../FlatList';
import type { LocaleIds } from '../locale';
import type { SectionListProps } from '../SectionList';
import type { HeaderProps } from './Container/Header/type';
import type { LayoutChangeEvent } from 'react-native';

export type ModalProps = {
  headerShown?: boolean;
  trigger?: ReactElement<any>;
  visible?: boolean;
  closeAction?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
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
  extraElement?: ReactNode;
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
  flatListProps?: FlatListProps;
  sectionListProps?: SectionListProps<any>;
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

  forceDesktop?: boolean;
  enableMobileFooterWrap?: boolean;
} & HeaderProps;

const defaultProps = {
  closeable: true,
  size: 'xs',
  height: 'auto',
  maxHeight: '90%',
  modalHeight: 'full',
  headerShown: true,
  closeOnOverlayClick: true,
  forceDesktop: false,
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
  onLayout,
  sectionListProps,
  flatListProps,
  scrollViewProps,
  staticChildrenProps,
  sortableListProps,
  header,
  headerShown,
  modalHeight,
  forceDesktop,
  rightContent,
  ...rest
}: ModalProps) => {
  const { size } = useUserDevice();
  const modalRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      ModalRefStore.ref = modalRef;
    }, []),
  );

  const isVerticalLayout = useIsVerticalLayout();

  const bodyPadding = useMemo(() => {
    if (isVerticalLayout) return 16;
    return 24;
  }, [isVerticalLayout]);

  const modalContent = useMemo(() => {
    let content = (
      <Box
        // eslint-disable-next-line no-nested-ternary
        pt={`${headerShown ? (header ? bodyPadding : 0) : bodyPadding}px`}
        pb={`${bodyPadding}px`}
        px={`${bodyPadding}px`}
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
            paddingBottom: bodyPadding,
            // eslint-disable-next-line no-nested-ternary
            paddingTop: headerShown ? (header ? bodyPadding : 0) : bodyPadding,
          }}
          px={`${bodyPadding}px`}
          {...sectionListProps}
        />
      );
    } else if (flatListProps) {
      content = (
        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: bodyPadding,
            // eslint-disable-next-line no-nested-ternary
            paddingTop: headerShown ? (header ? bodyPadding : 0) : bodyPadding,
          }}
          px={`${bodyPadding}px`}
          {...flatListProps}
        />
      );
    } else if (scrollViewProps) {
      content = (
        <ScrollView
          testID="Modal-ScrollView-Container"
          keyboardShouldPersistTaps="handled"
          px={`${bodyPadding}px`}
          {...scrollViewProps}
          contentContainerStyle={{
            paddingBottom: bodyPadding,
            // eslint-disable-next-line no-nested-ternary
            paddingTop: headerShown ? (header ? bodyPadding : 0) : bodyPadding,
            ...(scrollViewProps.contentContainerStyle as any),
          }}
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
                paddingBottom: bodyPadding,
                paddingTop: bodyPadding,
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
    headerShown,
    header,
    bodyPadding,
    rest.children,
    sectionListProps,
    flatListProps,
    scrollViewProps,
    sortableListProps,
    staticChildrenProps,
  ]);

  const modalContainer = useMemo(() => {
    if (!forceDesktop) {
      const isSmallScreen = ['SMALL', 'NORMAL'].includes(size);
      if (
        isSmallScreen ||
        /*
          Why `platformEnv.isNativeIOS` ?
          We want to use the native modal component in iPad which screen width might bigger then NORMAL breakpoint
        */
        platformEnv.isNativeIOS
      ) {
        return (
          <Box flex={1} alignItems="flex-end" w="100%" flexDirection="row">
            <Box
              ref={modalRef}
              onLayout={onLayout}
              height={modalHeight}
              // TODO 100vh in App
              maxHeight={platformEnv.isRuntimeBrowser ? '100vh' : undefined}
              w="100%"
              borderBottomRadius={isSmallScreen ? 0 : '24px'}
              borderTopRadius={
                platformEnv.isExtensionUiStandaloneWindow ||
                platformEnv.isNativeAndroid ||
                ((platformEnv.isWeb ||
                  platformEnv.isExtension ||
                  platformEnv.isDesktop ||
                  platformEnv.isRuntimeBrowser) &&
                  isVerticalLayout)
                  ? 0
                  : '24px'
              }
              overflow="hidden"
              testID="ModalContentContainerMobile"
            >
              <Mobile
                onClose={onModalClose}
                headerShown={headerShown}
                header={header}
                rightContent={rightContent}
                {...rest}
              >
                {modalContent}
              </Mobile>
            </Box>
          </Box>
        );
      }
    }

    return (
      <Desktop
        onLayout={onLayout}
        onClose={onModalClose}
        headerShown={headerShown}
        header={header}
        rightContent={rightContent}
        {...rest}
      >
        {modalContent}
      </Desktop>
    );
  }, [
    forceDesktop,
    onModalClose,
    headerShown,
    header,
    rightContent,
    rest,
    modalContent,
    size,
    onLayout,
    modalHeight,
    isVerticalLayout,
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
