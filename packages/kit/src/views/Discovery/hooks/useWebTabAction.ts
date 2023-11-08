import {
  addBlankWebTabAtom,
  addWebTabAtom,
  closeAllWebTabsAtom,
  closeWebTabAtom,
  setCurrentWebTabAtom,
  setWebTabDataAtom,
  setWebTabsAtom,
  useAtomWebTabs,
} from '../container/Context/contextWebTabs';

function useWebTabAction() {
  const [, addWebTab] = useAtomWebTabs(addWebTabAtom);
  const [, addBlankWebTab] = useAtomWebTabs(addBlankWebTabAtom);
  const [, setWebTabs] = useAtomWebTabs(setWebTabsAtom);
  const [, setWebTabData] = useAtomWebTabs(setWebTabDataAtom);
  const [, closeWebTab] = useAtomWebTabs(closeWebTabAtom);
  const [, closeAllWebTab] = useAtomWebTabs(closeAllWebTabsAtom);
  const [, setCurrentWebTab] = useAtomWebTabs(setCurrentWebTabAtom);

  console.log('useWebTabAction render ===>');

  return {
    addWebTab,
    addBlankWebTab,
    setWebTabs,
    setWebTabData,
    closeWebTab,
    closeAllWebTab,
    setCurrentWebTab,
  };
}

export default useWebTabAction;
