import type { ComponentProps, FC } from 'react';

import {
  Box,
  KeyboardAvoidingView,
  Modal,
  PinCode,
  Typography,
} from '@onekeyhq/components';

import { SkipAppLock } from '../../../components/AppLock';

export type HardwarePinCodeViewProp = {
  title?: string;
  description?: string;
  securityReminder?: string;
} & {
  onComplete: Pick<
    ComponentProps<typeof PinCode>,
    'onCodeCompleted'
  >['onCodeCompleted'];
};

const HardwarePinCode: FC<HardwarePinCodeViewProp> = ({
  title,
  description,
  securityReminder,
  onComplete,
}) => (
  <>
    <SkipAppLock />
    <Modal header="PIN" footer={null}>
      <KeyboardAvoidingView flex={1} keyboardVerticalOffset={120}>
        <Box
          flexDirection="column"
          alignItems="center"
          h="100%"
          justifyContent="space-between"
        >
          <Box alignItems="center">
            <Typography.DisplayXLarge
              mt={8}
              mx={9}
              color="text-default"
              textAlign="center"
            >
              {title}
            </Typography.DisplayXLarge>
            <Typography.Body1
              mt={2}
              mx={9}
              color="text-subdued"
              textAlign="center"
            >
              {description}
            </Typography.Body1>

            <Box mt={8}>
              <PinCode
                autoFocus
                onCodeCompleted={(pinCode) => onComplete?.(pinCode)}
              />
            </Box>
          </Box>

          <Typography.Body2 mb={3} px={8} textAlign="center">
            {securityReminder}
          </Typography.Body2>
        </Box>
      </KeyboardAvoidingView>
    </Modal>
  </>
);

export default HardwarePinCode;
