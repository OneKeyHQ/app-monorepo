import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';

type PinPanelProps = {};

const defaultProps = {} as const;

const PinPanel: FC<PinPanelProps> = () => {
  const intl = useIntl();

  return (
    <>
      <Box
        position="absolute"
        top={2}
        right={2}
        w={280}
        p={4}
        bgColor="surface-default"
        rounded="xl"
        borderWidth={1}
        borderColor="divider"
      >
        123
      </Box>
    </>
  );
};

PinPanel.defaultProps = defaultProps;

export default PinPanel;
