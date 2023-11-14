import { withProviderBrowserBookmark } from '../../store/contextBrowserBookmark';
import { withProviderBrowserHistory } from '../../store/contextBrowserHistory';
import { withProviderWebTabs } from '../../store/contextWebTabs';

export function withBrowserProvider<T = any>(
  WrappedComponent: React.ComponentType<T>,
): (props: T) => React.JSX.Element {
  return withProviderWebTabs(
    withProviderBrowserHistory(withProviderBrowserBookmark(WrappedComponent)),
  );
}
