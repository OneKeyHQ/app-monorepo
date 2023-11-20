import {
  addBrowserBookmarkAtom,
  removeBrowserBookmarkAtom,
  setBookmarkDataAtom,
  useAtomBrowserBookmark,
} from '../store/contextBrowserBookmark';

function useBrowserBookmarkAction() {
  const [, addBrowserBookmark] = useAtomBrowserBookmark(addBrowserBookmarkAtom);
  const [, removeBrowserBookmark] = useAtomBrowserBookmark(
    removeBrowserBookmarkAtom,
  );
  const [, setBookmarkData] = useAtomBrowserBookmark(setBookmarkDataAtom);
  return {
    addBrowserBookmark,
    removeBrowserBookmark,
    setBookmarkData,
  };
}

export default useBrowserBookmarkAction;
