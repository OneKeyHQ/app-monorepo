import { memo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

const commonTextProps = { size: '$bodySm', color: '$textSubdued' } as const;

function HoldersHeaderBase() {
  return (
    <XStack
      px="$4"
      py="$3"
      alignItems="center"
      gap="$3"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      <SizableText {...commonTextProps} minWidth="$6">
        Rank
      </SizableText>
      <SizableText {...commonTextProps} flex={1}>
        Address
      </SizableText>
      <SizableText {...commonTextProps} minWidth="$16" textAlign="right">
        %
      </SizableText>
      <SizableText {...commonTextProps} minWidth="$20" textAlign="right">
        Amount
      </SizableText>
      <SizableText {...commonTextProps} minWidth="$20" textAlign="right">
        Value
      </SizableText>
    </XStack>
  );
}

const HoldersHeader = memo(HoldersHeaderBase);

export { HoldersHeader };
