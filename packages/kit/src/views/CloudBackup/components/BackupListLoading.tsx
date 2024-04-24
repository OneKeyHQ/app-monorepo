import { Skeleton, Stack } from '@onekeyhq/components';

export default function BackupListLoading() {
  return (
    <Stack flex={1} px="$5" space="$2" pt="$5">
      <Skeleton h="$6" w="70%" />
      <Skeleton h="$6" w="100%" />
      <Skeleton h="$6" w="70%" />
      <Skeleton h="$6" w="100%" />
    </Stack>
  );
}
