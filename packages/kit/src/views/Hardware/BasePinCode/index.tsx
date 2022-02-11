import React, { FC } from 'react';

import { Box, Modal, PinCode, Typography } from '@onekeyhq/components';

export type HardwarePinCodeViewProp = {
  title?: string;
  description?: string;
  securityReminder?: string;
  onComplete?: (pinCode: string) => Promise<boolean | void>;
};

const HardwarePinCode: FC<HardwarePinCodeViewProp> = ({
  title,
  description,
  securityReminder,
  onComplete,
}) => {
  console.log('HardwarePinCode title:', title);

  return (
    <Modal header="PIN" footer={null}>
      <Box alignItems="center" flex={1}>
        <Typography.DisplayXLarge
          mt={8}
          mx={9}
          color="text-default"
          textAlign="center"
        >
          {title}
        </Typography.DisplayXLarge>
        <Typography.Body1 mt={2} mx={9} color="text-subdued" textAlign="center">
          {description}
        </Typography.Body1>

        <Box mt={8}>
          <PinCode
            onCodeCompleted={(pinCode) =>
              onComplete?.(pinCode) ?? Promise.resolve(false)
            }
          />
        </Box>
      </Box>
      <Typography.Body2 mb={3} px={8} textAlign="center">
        {securityReminder}
      </Typography.Body2>
    </Modal>
  );
};

export default HardwarePinCode;
