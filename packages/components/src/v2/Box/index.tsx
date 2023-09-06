import { Stack } from 'tamagui';

export function Box({ children, ...props }: React.PropsWithChildren<unknown>) {
  return <Stack {...props}>{children}</Stack>;
}
