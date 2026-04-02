import { Skeleton, Stack, XStack } from '@onekeyhq/components';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

function SignatureConfirmLoading() {
  return (
    <SignatureConfirmItem gap="$5">
      <SignatureConfirmItem>
        <Stack py="$1">
          <Skeleton height="$3" width="$12" />
        </Stack>
        <XStack gap="$3" alignItems="center">
          <Skeleton height="$10" width="$10" radius="round" />
          <Stack>
            <Stack py="$1.5">
              <Skeleton height="$3" width="$24" />
            </Stack>
            <Stack py="$1">
              <Skeleton height="$3" width="$12" />
            </Stack>
          </Stack>
        </XStack>
      </SignatureConfirmItem>
      <SignatureConfirmItem>
        <Stack py="$1">
          <Skeleton height="$3" width="$8" />
        </Stack>
        <Stack py="$1">
          <Skeleton height="$3" width="$56" />
        </Stack>
      </SignatureConfirmItem>
      <SignatureConfirmItem>
        <Stack py="$1">
          <Skeleton height="$3" width="$8" />
        </Stack>
        <Stack py="$1">
          <Skeleton height="$3" width="$56" />
        </Stack>
      </SignatureConfirmItem>
      <SignatureConfirmItem>
        <Stack py="$1">
          <Skeleton height="$3" width="$8" />
        </Stack>
        <Stack py="$1">
          <Skeleton height="$3" width="$56" />
        </Stack>
      </SignatureConfirmItem>
    </SignatureConfirmItem>
  );
}

export { SignatureConfirmLoading };
