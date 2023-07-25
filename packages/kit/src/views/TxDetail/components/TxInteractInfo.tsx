import type { ComponentProps, FC } from 'react';
import { useMemo } from 'react';

import { Box } from '@onekeyhq/components';

import { DappSecurityView } from '../../Send/components/DappSecurityView';

type Props = {
  origin: string;
  networkId: string;
  name?: string;
  icon?: string;
} & ComponentProps<typeof Box>;

export const TxInteractInfo: FC<Props> = ({
  origin,
  networkId,
  name,
  icon,
  ...rest
}) => {
  const parsed = useMemo(() => {
    try {
      return new URL(origin);
    } catch (error) {
      // pass
    }
  }, [origin]);
  if (!parsed) {
    return null;
  }
  return (
    <Box
      bg="surface-default"
      borderColor="border-default"
      borderWidth={1}
      borderRadius={12}
      paddingX={4}
      paddingY={3}
      mb={6}
      {...rest}
    >
      <DappSecurityView
        hostname={parsed.hostname}
        origin={parsed.origin}
        networkId={networkId}
        name={name}
        icon={icon}
      />
    </Box>
  );
};
