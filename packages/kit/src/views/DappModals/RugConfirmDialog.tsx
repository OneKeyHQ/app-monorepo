import type { FC } from 'react';
import { useState } from 'react';

import { Column } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  CheckBox,
  Dialog,
  Icon,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

type RugDialogProps = {
  visible: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
};

// TODO: Update dialog component to support custom content
const RugConfirmDialog: FC<RugDialogProps> = ({
  visible,
  onCancel,
  onConfirm,
}) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const [isUserConfirmUseRug, setIsUserConfirmUseRug] = useState(false);

  const handleConfirm = () => {
    if (!isUserConfirmUseRug) return;
    onConfirm?.();
  };

  return (
    <Dialog
      // TODO: Update background color when container is stylable
      // containerProps={{ bgColor: 'surface-default' }}
      visible={visible}
      onClose={onCancel}
    >
      <Column w="100%" alignItems="center" mb={4}>
        <Center
          mb={5}
          borderRadius="999"
          size="48px"
          backgroundColor="surface-neutral-default"
        >
          <Icon name="ExclamationTriangleOutline" size={24} />
        </Center>
        <Text
          typography={{ sm: 'Heading', md: 'DisplayMedium' }}
          color="text-default"
          mb={2}
        >
          {intl.formatMessage({ id: 'modal__rug_warning' })}
        </Text>
        <Text
          typography={{ sm: 'Body2', md: 'Body1' }}
          color="text-subdued"
          textAlign="center"
        >
          {intl.formatMessage({ id: 'modal__rug_warning_desc' })}
        </Text>
        {/* TODO: Add radio and confirm text */}

        <CheckBox
          mt={5}
          alignItems="center"
          onChange={(isSelected) => setIsUserConfirmUseRug(isSelected)}
          isChecked={isUserConfirmUseRug}
        >
          <Text
            color="text-subdued"
            ml={2}
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          >
            {intl.formatMessage({
              id: 'content__i_am_aware_of_the_above_risks',
            })}
          </Text>
        </CheckBox>
      </Column>
      {/* TODO: Add footer actions */}
      <Box flexDirection="row" w="100%" mt={2}>
        <Button flex="1" onPress={onCancel} size={isVertical ? 'lg' : 'base'}>
          {intl.formatMessage({
            id: 'action__cancel',
          })}
        </Button>
        <Box w={4} />
        <Button
          flex={1}
          type="primary"
          size={isVertical ? 'lg' : 'base'}
          onPress={handleConfirm}
          isDisabled={!isUserConfirmUseRug}
        >
          {intl.formatMessage({
            id: 'action__confirm',
          })}
        </Button>
      </Box>
    </Dialog>
  );
};

export default RugConfirmDialog;
