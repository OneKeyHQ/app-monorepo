import type { FC } from 'react';
import { useEffect, useRef } from 'react';

import { Modalize } from 'react-native-modalize';

import {
  Box,
  Center,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useThemeValue,
} from '@onekeyhq/components';
import { CloseBackDrop } from '@onekeyhq/components/src/Select';
import { useCloseOnEsc } from '@onekeyhq/kit/src/hooks/useOnKeydown';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Header from '../Modal/Container/Header/Header';

import type { HeaderProps } from '../Modal/Container/Header/type';
import type { ModalizeProps } from 'react-native-modalize';

interface BottomSheetModalProps {
  closeOverlay: () => void;
  title: HeaderProps['header'];
  headerDescription?: HeaderProps['headerDescription'];
  headerRight?: HeaderProps['rightContent'];
  modalLizeProps?: ModalizeProps;
  showCloseButton?: boolean;
  showHeader?: boolean;
}

const isFlatStyle = !platformEnv.isNativeIOS;

const Mobile: FC<BottomSheetModalProps> = ({
  closeOverlay,
  children,
  modalLizeProps,
  title,
  headerDescription,
  headerRight,
  showCloseButton = true,
  showHeader = true,
}) => {
  const modalizeRef = useRef<Modalize>(null);

  const bg = useThemeValue('background-default');

  const { bottom } = useSafeAreaInsets();
  useEffect(() => {
    setTimeout(() => modalizeRef.current?.open(), 10);
  }, []);
  return (
    <Modalize
      ref={modalizeRef}
      onClosed={closeOverlay}
      closeOnOverlayTap
      keyboardAvoidingBehavior={platformEnv.isNativeIOS ? 'height' : 'padding'}
      adjustToContentHeight
      withHandle={false}
      modalStyle={{
        backgroundColor: bg,
        borderTopLeftRadius: isFlatStyle ? 0 : 24,
        borderTopRightRadius: isFlatStyle ? 0 : 24,
        overflow: 'hidden',
      }}
      {...modalLizeProps}
    >
      <Box pb={`${bottom}px`}>
        {showHeader && (
          <Header
            header={title}
            headerDescription={headerDescription}
            hideBackButton
            onPressCloseButton={closeOverlay}
            closeable={showCloseButton}
            rightContent={headerRight}
          />
        )}

        <Box p={4}>{children}</Box>
      </Box>
    </Modalize>
  );
};

const Desktop: FC<BottomSheetModalProps> = ({
  closeOverlay,
  children,
  title,
  headerRight,
  showCloseButton = true,
  showHeader = true,
}) => (
  <Center w="full" h="full">
    <CloseBackDrop
      onClose={closeOverlay}
      backgroundColor="rgba(0, 0, 0, 0.5)"
    />
    <Box
      overflow="hidden"
      bg="background-default"
      w="400px"
      borderRadius="24px"
      borderWidth="1px"
      borderColor="border-subdued"
    >
      {showHeader && (
        <Header
          header={title}
          hideBackButton
          onPressCloseButton={closeOverlay}
          closeable={showCloseButton}
          rightContent={headerRight}
        />
      )}
      <Box p={6}>{children}</Box>
    </Box>
  </Center>
);

const BottomSheetModal: FC<BottomSheetModalProps> = (props) => {
  const isVerticalLayout = useIsVerticalLayout();
  // eslint-disable-next-line react/destructuring-assignment
  useCloseOnEsc(props.closeOverlay);

  return isVerticalLayout ? <Mobile {...props} /> : <Desktop {...props} />;
};
export default BottomSheetModal;
