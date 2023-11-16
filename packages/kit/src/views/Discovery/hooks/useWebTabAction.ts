import {
  addBlankWebTabAtom,
  addWebTabAtom,
  closeAllWebTabsAtom,
  closeWebTabAtom,
  refreshTabsAtom,
  setCurrentWebTabAtom,
  setPinnedTabAtom,
  setWebTabDataAtom,
  setWebTabsAtom,
  useAtomWebTabs,
} from '../store/contextWebTabs';

function useWebTabAction() {
  const [, addWebTab] = useAtomWebTabs(addWebTabAtom);
  const [, addBlankWebTab] = useAtomWebTabs(addBlankWebTabAtom);
  const [, setWebTabs] = useAtomWebTabs(setWebTabsAtom);
  const [, refreshTabs] = useAtomWebTabs(refreshTabsAtom);
  const [, setWebTabData] = useAtomWebTabs(setWebTabDataAtom);
  const [, closeWebTab] = useAtomWebTabs(closeWebTabAtom);
  const [, closeAllWebTab] = useAtomWebTabs(closeAllWebTabsAtom);
  const [, setCurrentWebTab] = useAtomWebTabs(setCurrentWebTabAtom);
  const [, setPinnedTab] = useAtomWebTabs(setPinnedTabAtom);

  return {
    addWebTab,
    addBlankWebTab,
    setWebTabs,
    refreshTabs,
    setWebTabData,
    closeWebTab,
    closeAllWebTab,
    setCurrentWebTab,
    setPinnedTab,
  };
}

export default useWebTabAction;
