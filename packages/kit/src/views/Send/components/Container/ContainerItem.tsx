import { Stack } from '@onekeyhq/components';

function ContainerItem({ children }: { children: React.ReactNode }) {
  return (
    <Stack width="100%" px="$4" py="$3">
      {children}
    </Stack>
  );
}

export { ContainerItem };
