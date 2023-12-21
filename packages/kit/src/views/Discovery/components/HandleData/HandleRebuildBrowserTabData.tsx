import { useEffect } from 'react';

import {
  useBrowserBookmarkAction,
  useBrowserHistoryAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import {
  useBrowserBookmarksDataFromSimpleDb,
  useBrowserHistoryDataFromSimpleDb,
  useBrowserTabDataFromSimpleDb,
} from '../../hooks/useBrowserDataFromSimpleDb';

function HandleRebuildTabData() {
  const result = useBrowserTabDataFromSimpleDb();
  const { buildWebTabs } = useBrowserTabActions().current;

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      buildWebTabs({ data });
    }
  }, [result.result, buildWebTabs]);

  return null;
}

function HandleRebuildBookmarksData() {
  const result = useBrowserBookmarksDataFromSimpleDb();
  const { buildBookmarkData } = useBrowserBookmarkAction().current;

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      buildBookmarkData(data);
    }
  }, [result.result, buildBookmarkData]);

  return null;
}

function HandleRebuildHistoryData() {
  const result = useBrowserHistoryDataFromSimpleDb();
  const { buildHistoryData } = useBrowserHistoryAction().current;

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      buildHistoryData(data);
    }
  }, [result.result, buildHistoryData]);

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
