import React, {
  FC,
  ReactElement,
  useMemo,
  useState,
  useCallback,
  cloneElement,
  ComponentProps,
  ReactNode,
} from 'react';

import { useUserDevice } from '../Provider/hooks';
import Mobile from './Container/Mobile';
import Desktop from './Container/Desktop';

import Button from '../Button';

export type ModalProps = {
  // TODO: translation id
  header?: string;
  trigger?: ReactElement<any>;
  visible?: boolean;
  closeable?: boolean;
  primaryActionTranslationId?: string;
  secondaryActionTranslationId?: string;
  onPrimaryActionPress?: ({ onClose }: { onClose?: () => void }) => void;
  onSecondaryActionPress?: () => void;
  hidePrimaryAction?: boolean;
  hideSecondaryAction?: boolean;
  primaryActionProps?: ComponentProps<typeof Button>;
  secondaryActionProps?: ComponentProps<typeof Button>;
  footer?: ReactNode;
  onClose?: () => void;
  onVisibleChange?: (v: boolean) => void;
};

const defaultProps = {
  closeable: true,
} as const;

const Modal: FC<ModalProps> = ({
  trigger,
  visible: outerVisible,
  onClose,
  ...rest
}) => {
  const { size } = useUserDevice();
  const [innerVisible, setInnerVisible] = useState(false);
  const visible = outerVisible ?? innerVisible;

  const handleClose = useCallback(() => {
    setInnerVisible((v) => !v);
    onClose?.();
  }, [onClose]);

  const handleOpen = useCallback(() => {
    setInnerVisible((v) => !v);
  }, []);

  const modalContainer = useMemo(() => {
    if (['SMALL', 'NORMAL'].includes(size)) {
      return <Mobile visible={visible} onClose={handleClose} {...rest} />;
    }

    return <Desktop visible={visible} onClose={handleClose} {...rest} />;
  }, [size, visible, handleClose, rest]);

  const triggerNode = useMemo(() => {
    if (!trigger) return null;
    return cloneElement(trigger, { onPress: handleOpen });
  }, [trigger, handleOpen]);

  return (
    <>
      {triggerNode}
      {modalContainer}
    </>
  );
};

Modal.defaultProps = defaultProps;

export default Modal;
