import { type FC, useContext } from 'react';

import { Box, Center, Spinner, Typography } from '@onekeyhq/components';

import {
  LimitOrderButtonProgressContext,
  SwapButtonProgressContext,
} from '../../context';

import type { ProgressStatus } from '../../typings';

const ProgressStatusButton: FC<{ progressStatus?: ProgressStatus }> = ({
  progressStatus,
}) => {
  const title = progressStatus?.title;
  if (!title) {
    return (
      <Center
        bg="action-primary-disabled"
        w="full"
        h="50px"
        shadow="1"
        borderRadius="12"
        overflow="hidden"
      >
        <Spinner size="sm" />
      </Center>
    );
  }
  return (
    <Center
      bg="action-primary-disabled"
      w="full"
      h="50px"
      shadow="1"
      borderRadius="12"
      overflow="hidden"
    >
      <Box flexDirection="row" alignItems="center" justifyItems="center">
        <Spinner size="sm" />
        <Typography.Button2 ml="2" color="text-disabled">
          {title}
        </Typography.Button2>
      </Box>
    </Center>
  );
};

export const SwapProgressButton = () => {
  const btnCtx = useContext(SwapButtonProgressContext);
  return <ProgressStatusButton progressStatus={btnCtx.progressStatus} />;
};

export const LimitOrderProgressButton = () => {
  const btnCtx = useContext(LimitOrderButtonProgressContext);
  return <ProgressStatusButton progressStatus={btnCtx.progressStatus} />;
};
