import type { FC } from 'react';
import { Fragment, memo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getDisplayKeysMap } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import Box from '../Box';
import Tooltip from '../Tooltip';
import Typography from '../Typography';

const displayKeysMap = getDisplayKeysMap(platformEnv.isDesktopMac);

export const DisplayKeyBlock = ({ children }: { children: string }) => {
  const key =
    // @ts-ignore
    displayKeysMap[children] || children;
  return (
    <Box
      bg="surface-neutral-subdued"
      borderRadius="6px"
      px="6px"
      height="20px"
      justifyContent="center"
      alignItems="center"
      ml="2px"
    >
      <Typography.CaptionStrong>{key}</Typography.CaptionStrong>
    </Box>
  );
};

interface ShortcutsProps {
  desc: string;
  keys: string | null;
}

export const ShortcutsDescription = memo(({ desc, keys }: ShortcutsProps) => {
  const displayKeys = keys
    ?.split('+')
    .map((key, index) => <DisplayKeyBlock key={index}>{key}</DisplayKeyBlock>);
  return (
    <Box p="8px" flexDirection="row" justifyContent="space-between">
      <Typography.Body2>{desc}</Typography.Body2>
      <Box ml="6px" flexDirection="row">
        {displayKeys}
      </Box>
    </Box>
  );
});
ShortcutsDescription.displayName = 'ShortcutsDescription';

const ShortcutsTooltip: FC<ShortcutsProps> = platformEnv.isDesktop
  ? ({ desc, keys, children }) => (
      <Tooltip
        bg="surface-neutral-default"
        openDelay={800}
        hasArrow
        // @ts-ignore
        label={<ShortcutsDescription desc={desc} keys={keys} />}
      >
        {children}
      </Tooltip>
    )
  : Fragment;
export default ShortcutsTooltip;
