import React, {
  ComponentProps,
  FC,
  ReactElement,
  ReactNode,
  cloneElement,
  useMemo,
} from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../Box';
import Button from '../Button';
import FlatList from '../FlatList';
import { LocaleIds } from '../locale';
import { useUserDevice } from '../Provider/hooks';
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
  headerShown?: boolean;
  headerDescription?: string;
  trigger?: ReactElement<any>;
  visible?: boolean;
  closeable?: boolean;
  closeAction?: () => void;
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
};

const defaultProps = {
  closeable: true,
  size: 'xs',
  height: 'auto',
  maxHeight: '90%',
  modalHeight: 'full',
  headerShown: true,
} as const;

const Modal: FC<ModalProps> = ({
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
}) => {
  const { size } = useUserDevice();

  const modalContent = useMemo(() => {
    if (sectionListProps) {
      return (
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
    }

    if (flatListProps) {
      return (
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
    }

    if (scrollViewProps) {
      return (
        <ScrollView
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
    }

    if (sortableListProps) {
      return (
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
    }

    if (staticChildrenProps) {
      return <Box {...staticChildrenProps}>{rest.children}</Box>;
    }

    return (
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
    if (['SMALL', 'NORMAL'].includes(size)) {
      return (
        <Box flex={1} alignItems="flex-end" w="100%" flexDirection="row">
          <Box
            height={modalHeight}
            // TODO 100vh in App
            maxHeight={platformEnv.isRuntimeBrowser ? '100vh' : undefined}
            w="100%"
            borderTopRadius={
              platformEnv.isExtensionUiStandaloneWindow ? 0 : '24px'
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

Modal.defaultProps = defaultProps;

export default Modal;
