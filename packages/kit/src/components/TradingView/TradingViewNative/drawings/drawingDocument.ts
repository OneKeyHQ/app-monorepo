import {
  readChartLocalStorage,
  writeChartLocalStorage,
} from '../chartLocalStorage';

import { parseDrawings } from './model';

import type { IDrawingHistory } from './model';

type IDrawingDocumentState = {
  history: IDrawingHistory;
  saveFailed: boolean;
  // Settles once the saved drawings are in `history`.
  loaded: Promise<void>;
  charts: Set<() => void>;
};

// One live document per storage key. Charts showing the same key, such as one
// token in several split-view panels, edit the same drawings and undo history.
// The chart's main runtime owns this map, like the write queue. A document
// lasts while a chart shows it; afterwards storage is read again.
const documents = new Map<string, IDrawingDocumentState>();

function createDocumentState(key?: string): IDrawingDocumentState {
  const shared: IDrawingDocumentState = {
    history: { past: [], present: [], future: [] },
    saveFailed: false,
    loaded: Promise.resolve(),
    charts: new Set(),
  };
  if (key) {
    shared.loaded = (async () => {
      try {
        const drawings = parseDrawings(await readChartLocalStorage(key));
        shared.history = { past: [], present: drawings, future: [] };
      } catch {
        // Drawing remains available when preference storage cannot be read.
      }
    })();
  }
  return shared;
}

/**
 * Joins the drawings saved under `key`; without a key they stay with this
 * chart and are not saved. `onChange` runs when another chart edits them or
 * the save status changes.
 */
export function openDrawingDocument(
  key: string | undefined,
  onChange: () => void,
) {
  let state = key ? documents.get(key) : undefined;
  if (!state) {
    state = createDocumentState(key);
    if (key) documents.set(key, state);
  }
  const shared = state;
  shared.charts.add(onChange);
  const notify = (except?: () => void) => {
    for (const chart of shared.charts) {
      if (chart !== except) chart();
    }
  };
  return {
    loaded: shared.loaded,
    get history() {
      return shared.history;
    },
    get saveFailed() {
      return shared.saveFailed;
    },
    commit(history: IDrawingHistory) {
      shared.history = history;
      notify(onChange);
      if (!key) return;
      void writeChartLocalStorage(key, JSON.stringify(history.present)).then(
        () => {
          if (shared.saveFailed) {
            shared.saveFailed = false;
            notify();
          }
        },
        () => {
          if (!shared.saveFailed) {
            shared.saveFailed = true;
            notify();
          }
        },
      );
    },
    close() {
      shared.charts.delete(onChange);
      if (key && !shared.charts.size && documents.get(key) === shared) {
        documents.delete(key);
      }
    },
  };
}

export type IDrawingDocument = ReturnType<typeof openDrawingDocument>;
