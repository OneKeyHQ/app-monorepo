import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, Center, Progress, Typography } from '@onekeyhq/components';
import { SkipAppLock } from '@onekeyhq/kit/src/components/AppLock';

export type RunningViewProps = {
  progress: number;
  hint: string;
  showBatteryAlert?: boolean;
};

const RunningView: FC<RunningViewProps> = ({
  progress,
  hint,
  showBatteryAlert,
}) => {
  const intl = useIntl();
  return (
    <>
      <SkipAppLock />
      <Box
        flexDirection="column"
        alignItems="center"
        h="100%"
        justifyContent="space-between"
      >
        <Center flex={1} alignItems="center" w="100%" minHeight={260}>
          <Typography.DisplayMedium>
            {intl.formatMessage({ id: 'modal__updating' })}
          </Typography.DisplayMedium>

          <Box px={2} width="full" mt={8}>
            <Progress.Bar value={progress} />
          </Box>

          <Typography.Body2 mt={3} textAlign="center">
            {hint}
          </Typography.Body2>
        </Center>

        {showBatteryAlert ? (
          <Alert
            title={intl.formatMessage({
              id: 'msg__keep_device_charged_during_update_or_may_cause_malfunction',
            })}
            dismiss={false}
            alertType="warn"
          />
        ) : (
          <Typography.Body2
            mb={3}
            px={8}
            textAlign="center"
            color="text-subdued"
          >
            {intl.formatMessage({
              id: 'modal__updating_attention',
            })}
          </Typography.Body2>
        )}
      </Box>
    </>
  );
};

export default RunningView;
