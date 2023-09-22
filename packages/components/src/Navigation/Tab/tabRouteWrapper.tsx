import { Stack } from '../../Stack';

export function tabRouteWrapper(WrappedComponent: any): () => JSX.Element {
  return function TabLayoutWrapper() {
    return (
      <Stack flex={1}>
        <WrappedComponent />
      </Stack>
    );
  };
}
