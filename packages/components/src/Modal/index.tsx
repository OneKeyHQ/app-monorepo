import React, {
  ComponentProps,
  FC,
  ReactElement,
  ReactNode,
  cloneElement,
  useCallback,
  useMemo,
  useState,
} from 'react';

import Button from '../Button';
import { useUserDevice } from '../Provider/hooks';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';

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
  onClose?: () => void | boolean;
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
    if (typeof onClose === 'function') {
      const status = onClose();
      // only onClose return false, will not trigger modal close
      if (status === false) return;
    }
    setInnerVisible((v) => !v);
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
    return cloneElement(trigger, {
      /* eslint @typescript-eslint/no-unsafe-member-access: "off" */
      onPress: trigger.props.onPress ?? handleOpen,
    });
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
