import {
  addBrowserHistoryAtom,
  removeBrowserHistoryAtom,
  useAtomBrowserHistory,
} from '../store/contextBrowserHistory';

function useBrowserHistoryAction() {
  const [, addBrowserHistory] = useAtomBrowserHistory(addBrowserHistoryAtom);
  const [, removeBrowserHistory] = useAtomBrowserHistory(
    removeBrowserHistoryAtom,
  );
  return {
    addBrowserHistory,
    removeBrowserHistory,
  };
}

export default useBrowserHistoryAction;
