export { useTabNameContext } from 'react-native-collapsible-tab-view';

// `useTabNameContext` from the lib THROWS when used outside a Tabs.Container.
// Components that render outside Tabs on native (e.g. Table inside a search
// dialog) must not call it. The tab name is only consumed by a web-only effect,
// so returning '' here is safe and crash-free on native.
export const useTabNameContextSafe = () => '';
