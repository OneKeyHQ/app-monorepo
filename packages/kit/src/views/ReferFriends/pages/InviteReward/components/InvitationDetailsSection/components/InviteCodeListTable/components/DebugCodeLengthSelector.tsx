import { useMemo, useState } from 'react';

import { Select, SizableText, Stack, XStack } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import type { IInviteCodeListItem } from '@onekeyhq/shared/src/referralCode/type';

import type { IInviteCodeListTableItem } from '../const';

export function useDebugCodeLength(items: IInviteCodeListItem[] | undefined): {
  tableItems: IInviteCodeListTableItem[] | undefined;
  debugSelector: React.ReactNode;
} {
  const [devSettings] = useDevSettingsPersistAtom();
  const showDebug = devSettings.enabled;

  const [debugCodeLength, setDebugCodeLength] = useState<string>('');

  const tableItems = useMemo(() => {
    if (!showDebug || !debugCodeLength || !items) return items;
    const len = Number(debugCodeLength);
    return items.map((item) => ({
      ...item,
      displayCode: item.code.slice(0, len).padEnd(len, 'X'),
    }));
  }, [items, debugCodeLength, showDebug]);

  const debugSelector = showDebug ? (
    <XStack gap="$2" alignItems="center" pb="$2">
      <SizableText size="$bodySm" color="$textSubdued">
        [DEV] Force code length:
      </SizableText>
      <Select
        title="Code Length"
        value={debugCodeLength}
        onChange={setDebugCodeLength}
        items={[
          { value: '', label: 'Auto' },
          ...Array.from({ length: 13 }, (_, i) => ({
            value: String(i + 3),
            label: `${i + 3} chars`,
          })),
        ]}
        renderTrigger={({ label }) => (
          <Stack
            px="$2"
            py="$1"
            borderWidth={1}
            borderColor="$borderStrong"
            borderRadius="$2"
            bg="$bgStrong"
          >
            <SizableText size="$bodySm">{label}</SizableText>
          </Stack>
        )}
      />
    </XStack>
  ) : null;

  return { tableItems, debugSelector };
}
