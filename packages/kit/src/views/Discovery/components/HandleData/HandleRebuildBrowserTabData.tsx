import { useEffect } from 'react';

import useBrowserBookmarkAction from '../../hooks/useBrowserBookmarkAction';
import {
  useBrowserBookmarksDataFromSimpleDb,
  useBrowserHistoryDataFromSimpleDb,
  useBrowserTabDataFromSimpleDb,
} from '../../hooks/useBrowserDataFromSimpleDb';
import useBrowserHistoryAction from '../../hooks/useBrowserHistoryAction';
import useWebTabAction from '../../hooks/useWebTabAction';

function HandleRebuildTabData() {
  const result = useBrowserTabDataFromSimpleDb();
  const { setWebTabs, addBlankWebTab } = useWebTabAction();

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      void setWebTabs({ data });
    }
  }, [result.result, addBlankWebTab, setWebTabs]);

  return null;
}

function HandleRebuildBookmarksData() {
  const result = useBrowserBookmarksDataFromSimpleDb();
  const { setBookmarkData } = useBrowserBookmarkAction();

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      setBookmarkData(data);
    }
  }, [result.result, setBookmarkData]);

  return null;
}

function HandleRebuildHistoryData() {
  const result = useBrowserHistoryDataFromSimpleDb();
  const { setHistoryData } = useBrowserHistoryAction();

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      setHistoryData(data);
    }
  }, [result.result, setHistoryData]);

  return null;
}

export function HandleRebuildBrowserData() {
  return (
    <>
      <HandleRebuildTabData />
      <HandleRebuildBookmarksData />
      <HandleRebuildHistoryData />
    </>
  );
}
