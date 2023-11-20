import {
  addBrowserHistoryAtom,
  removeBrowserHistoryAtom,
  setHistoryDataAtom,
  useAtomBrowserHistory,
} from '../store/contextBrowserHistory';

function useBrowserHistoryAction() {
  const [, addBrowserHistory] = useAtomBrowserHistory(addBrowserHistoryAtom);
  const [, removeBrowserHistory] = useAtomBrowserHistory(
    removeBrowserHistoryAtom,
  );
  const [, setHistoryData] = useAtomBrowserHistory(setHistoryDataAtom);
  return {
    addBrowserHistory,
    removeBrowserHistory,
    setHistoryData,
  };
}

export default useBrowserHistoryAction;
