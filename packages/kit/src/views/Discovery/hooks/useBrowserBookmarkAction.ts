import {
  addBrowserBookmarkAtom,
  removeBrowserBookmarkAtom,
  useAtomBrowserBookmark,
} from '../store/contextBrowserBookmark';

function useBrowserBookmarkAction() {
  const [, addBrowserBookmark] = useAtomBrowserBookmark(addBrowserBookmarkAtom);
  const [, removeBrowserBookmark] = useAtomBrowserBookmark(
    removeBrowserBookmarkAtom,
  );
  return {
    addBrowserBookmark,
    removeBrowserBookmark,
  };
}

export default useBrowserBookmarkAction;
