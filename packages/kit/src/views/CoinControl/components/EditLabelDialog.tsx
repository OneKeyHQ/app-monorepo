import { useCallback } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  HStack,
  VStack,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { showDialog } from '../../../utils/overlayUtils';

interface IEditLabelDialogProps {
  defaultLabel: string;
  onClose?: () => void;
  onConfirm: (label: string) => void;
}

const EditLabelDialog: FC<IEditLabelDialogProps> = ({
  onClose,
  onConfirm,
  defaultLabel,
}) => {
  const intl = useIntl();
  const isSmallLayout = useIsVerticalLayout();

  const { control, handleSubmit } = useForm<{ label: string }>({
    defaultValues: { label: defaultLabel },
  });

  const onSubmit = useCallback(
    ({ label }: { label: string }) => {
      onClose?.();
      onConfirm(label);
    },
    [onConfirm, onClose],
  );

  return (
    <Dialog visible onClose={onClose}>
      <VStack>
        <Form w="full" mt={5}>
          <Form.Item
            name="label"
            control={control}
            rules={{
              maxLength: {
                value: 15,
                message: intl.formatMessage({
                  id: 'msg__label_name_can_be_up_to_15_characters',
                }),
              },
            }}
          >
            <Form.Input
              onKeyPress={(e) => {
                if (e.nativeEvent.key === 'Enter') {
                  handleSubmit(onSubmit)();
                  return;
                }
                if (e.nativeEvent.key === 'Escape') {
                  onClose?.();
                }
              }}
              placeholder={intl.formatMessage({
                id: 'action__add_label',
              })}
            />
          </Form.Item>
        </Form>
        <HStack
          mt={6}
          mb={4}
          space={3}
          alignItems="center"
          justifyContent="center"
        >
          <Button
            size={isSmallLayout ? 'xl' : 'lg'}
            type="basic"
            flex={1}
            onPress={() => onClose?.()}
          >
            {intl.formatMessage({ id: 'action__cancel' })}
          </Button>
          <Button
            size={isSmallLayout ? 'xl' : 'lg'}
            type="primary"
            flex={1}
            onPress={handleSubmit(onSubmit)}
          >
            {intl.formatMessage({ id: 'action__confirm' })}
          </Button>
        </HStack>
      </VStack>
    </Dialog>
  );
};

const showEditLabelDialog = (props: IEditLabelDialogProps) => {
  showDialog(<EditLabelDialog {...props} />);
};

export { showEditLabelDialog };
