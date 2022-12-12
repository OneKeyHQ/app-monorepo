import { FC, ReactNode, useEffect, useRef } from 'react';

import { Modalize, ModalizeProps } from 'react-native-modalize';

import {
  Box,
  Center,
  IconButton,
  Typography,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useThemeValue,
} from '@onekeyhq/components';
import { CloseBackDrop } from '@onekeyhq/components/src/Select';
import { useCloseOnEsc } from '@onekeyhq/kit/src/hooks/useOnKeydown';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

interface BottomSheetModalProps {
  closeOverlay: () => void;
  title: string;
  headerRight?: () => ReactNode;
  modalLizeProps?: ModalizeProps;
}

const isFlatStyle = platformEnv.isNativeAndroid || platformEnv.isExtension;
const showCloseButton = !platformEnv.isNativeIOSPhone;

const Header: FC<{
  title: string;
  headerRight?: () => ReactNode;
  closeOverlay: () => void;
}> = ({ title, headerRight, closeOverlay }) => (
  <Box
    h="60px"
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
  >
    {platformEnv.isNativeIOS ? (
      <Typography.Heading
        position="absolute"
        left={0}
        right={0}
        textAlign="center"
      >
        {title}
      </Typography.Heading>
    ) : (
      <Typography.Heading flex={1}>{title}</Typography.Heading>
    )}

    <Box ml="auto" flexDirection="row" alignItems="center">
      {headerRight?.()}
      {showCloseButton && (
        <IconButton circle size="xs" name="XMarkMini" onPress={closeOverlay} />
      )}
    </Box>
  </Box>
);

const Mobile: FC<BottomSheetModalProps> = ({
  closeOverlay,
  children,
  modalLizeProps,
  title,
  headerRight,
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
      adjustToContentHeight
      withHandle={false}
      modalStyle={{
        backgroundColor: bg,
        borderTopLeftRadius: isFlatStyle ? 0 : 24,
        borderTopRightRadius: isFlatStyle ? 0 : 24,
        overflow: 'hidden',
        padding: 16,
        paddingTop: 0,
      }}
      {...modalLizeProps}
    >
      <Box pb={`${bottom}px`}>
        <Header
          title={title}
          headerRight={headerRight}
          closeOverlay={closeOverlay}
        />
        {children}
      </Box>
    </Modalize>
  );
};

const Desktop: FC<BottomSheetModalProps> = ({
  closeOverlay,
  children,
  title,
  headerRight,
}) => (
  <Center position="absolute" w="full" h="full" zIndex={999}>
    <CloseBackDrop
      onClose={closeOverlay}
      backgroundColor="rgba(61, 61, 77, 0.75)"
    />
    <Box
      overflow="hidden"
      bg="background-default"
      w="400px"
      pb="24px"
      px="24px"
      borderRadius="24px"
      borderWidth="1px"
      borderColor="border-subdued"
    >
      <Header
        title={title}
        headerRight={headerRight}
        closeOverlay={closeOverlay}
      />
      {children}
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
