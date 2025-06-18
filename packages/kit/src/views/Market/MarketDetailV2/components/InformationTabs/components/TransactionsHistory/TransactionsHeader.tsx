import { memo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

const commonTextProps = { size: '$bodySm', color: '$textSubdued' } as const;

function TransactionsHeaderBase() {
  return (
    <XStack
      px="$4"
      py="$3"
      alignItems="center"
      gap="$3"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      <SizableText {...commonTextProps} minWidth="$10">
        Time
      </SizableText>
      <SizableText {...commonTextProps} minWidth="$10">
        Type
      </SizableText>
      <SizableText {...commonTextProps} flex={1} minWidth="$32">
        Amount
      </SizableText>
      <SizableText {...commonTextProps} minWidth="$14" textAlign="right">
        Price
      </SizableText>
      <SizableText {...commonTextProps} minWidth="$16" textAlign="right">
        Value
      </SizableText>
      <SizableText {...commonTextProps} minWidth="$24">
        Address
      </SizableText>
    </XStack>
  );
}

const TransactionsHeader = memo(TransactionsHeaderBase);

export { TransactionsHeader };
