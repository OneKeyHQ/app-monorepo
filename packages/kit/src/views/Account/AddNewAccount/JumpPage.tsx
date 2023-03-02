import { useCallback } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  HStack,
  Text,
  VStack,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { showOverlay } from '../../../utils/overlayUtils';

interface IJumpPageDialogProps {
  currentPage: number;
  maxPage: number;
  onClose?: () => void;
  onConfirm: (page: number) => void;
}

const JumpPageDialog: FC<IJumpPageDialogProps> = ({
  onClose,
  onConfirm,
  maxPage,
  currentPage,
}) => {
  const intl = useIntl();
  const { control, handleSubmit } = useForm<{ pageNumber: string }>({
    defaultValues: { pageNumber: `${!currentPage ? '' : currentPage + 1}` },
  });

  const isSmallLayout = useIsVerticalLayout();

  const onSubmit = useCallback(
    ({ pageNumber }: { pageNumber: string }) => {
      onClose?.();
      setTimeout(() => onConfirm(parseInt(pageNumber)));
    },
    [onConfirm, onClose],
  );

  return (
    <Dialog visible onClose={onClose}>
      <VStack w="full" h="auto" testID="JumpPageBox">
        <Text typography={{ sm: 'DisplayMedium', md: 'DisplayMedium' }}>
          {intl.formatMessage({ id: 'title__jump_to_page' })}
        </Text>
        <Form w="full" mt={5}>
          <Form.Item
            name="pageNumber"
            control={control}
            rules={{
              pattern: {
                value: /^[0-9]*$/,
                message: intl.formatMessage({
                  id: 'msg__enter_a_number',
                }),
              },
              validate: (value) => {
                const pageNumber = parseInt(value);
                if (pageNumber <= 0) {
                  return intl.formatMessage({
                    id: 'msg__enter_a_number',
                  });
                }
                if (pageNumber > maxPage) {
                  return intl.formatMessage(
                    { id: 'msg__page_number_cannot_be_larger_than_str' },
                    { number: maxPage },
                  );
                }
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
                id: 'form__page_number_placeholder',
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

const showJumpPageDialog = (props: IJumpPageDialogProps) => {
  showOverlay((close) => <JumpPageDialog onClose={close} {...props} />);
};

export { showJumpPageDialog };
