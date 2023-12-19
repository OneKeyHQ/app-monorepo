import { Stack } from '@onekeyhq/components';

function ContainerItem({ children }: { children: React.ReactNode }) {
  return (
    <Stack width="100%" padding="$4">
      {children}
    </Stack>
  );
}

export { ContainerItem };
