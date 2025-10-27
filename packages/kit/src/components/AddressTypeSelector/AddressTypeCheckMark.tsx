import { memo, useMemo } from 'react';

import { Icon, Spinner, Stack } from '@onekeyhq/components';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

import { useAddressTypeSelectorDynamicContext } from './AddressTypeSelectorContext';

function AddressTypeCheckMark({
  accountId,
  deriveType,
}: {
  accountId: string | undefined;
  deriveType: IAccountDeriveTypes;
}) {
  const { activeDeriveType, isCreatingAddress, creatingDeriveType } =
    useAddressTypeSelectorDynamicContext();

  const isCreatingCurrentDeriveType = useMemo(() => {
    return deriveType === creatingDeriveType && isCreatingAddress;
  }, [deriveType, creatingDeriveType, isCreatingAddress]);

  return (
    <Stack
      w="$5"
      h="$5"
      $gtMd={{
        w: '$4',
        h: '$4',
      }}
      mr="$-1"
    >
      {!accountId && !isCreatingCurrentDeriveType ? (
        <Icon size="$4" name="PlusLargeOutline" color="$iconSubdued" />
      ) : null}
      {accountId && deriveType === activeDeriveType ? (
        <Icon size="$4" name="CheckmarkSolid" color="$iconActive" />
      ) : null}
      {isCreatingCurrentDeriveType ? <Spinner size="small" /> : null}
    </Stack>
  );
}

export default memo(AddressTypeCheckMark);
