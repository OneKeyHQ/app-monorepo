import { Provider } from 'jotai';

export function withJotaiProvider<P>(WrappedComponent: React.ComponentType<P>) {
  return function WithProvider(props: P) {
    return (
      <Provider>
        <WrappedComponent {...(props as any)} />
      </Provider>
    );
  };
}
