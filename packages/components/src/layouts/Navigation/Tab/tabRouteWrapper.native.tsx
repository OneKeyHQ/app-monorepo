import { Stack } from '../../../primitives';

export function tabRouteWrapper(WrappedComponent: any): () => JSX.Element {
  return function TabLayoutWrapper() {
    return (
      <Stack flex={1} testID="App-Navigation-Tab-Wrapper">
        <WrappedComponent />
      </Stack>
    );
  };
}
