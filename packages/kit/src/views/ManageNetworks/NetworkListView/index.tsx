import React, { FC, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Modal, useUserDevice } from '@onekeyhq/components';

import { useToast } from '../../../hooks/useToast';

import { DiscardAlert } from './DiscardAlert';
import { DisplayView } from './DisplayView';
import { EditableView } from './EditableView';

export const NetworkListView: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const [alertOpened, setAlertOpened] = useState(false);
  const [changed] = useState(true);
  const [editable, setEditable] = useState(false);
  const { size } = useUserDevice();
  const children = editable ? <EditableView /> : <DisplayView />;

  const onClose = useCallback(() => {}, []);

  const onPrepareClose = useCallback(() => {
    if (changed) {
      setAlertOpened(true);
    } else {
      onClose();
    }
  }, [changed, onClose]);

  const onCloseAlert = useCallback(() => setAlertOpened(false), []);
  const onCloseModal = useCallback(() => onClose(), [onClose]);

  const onToggle = useCallback(() => {
    if (editable) {
      toast.info(
        intl.formatMessage({
          id: 'msg__change_saved',
          defaultMessage: 'Change saved!',
        }),
      );
    }
    setEditable(!editable);
  }, [editable, intl, toast]);

  const secondaryActionTranslationId = editable
    ? 'action__done'
    : 'action__edit';

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__customize_network' })}
      height="560px"
      onClose={onPrepareClose}
      hidePrimaryAction
      secondaryActionProps={{
        type: editable ? 'primary' : 'basic',
        onPress: () => onToggle(),
        w: size === 'SMALL' ? 'full' : undefined,
      }}
      secondaryActionTranslationId={secondaryActionTranslationId}
      scrollViewProps={{
        children: (
          <>
            {children}
            <DiscardAlert
              visible={alertOpened}
              onConfirm={onCloseModal}
              onClose={onCloseAlert}
            />
          </>
        ),
      }}
    />
  );
};

export default NetworkListView;
