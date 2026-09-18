import BigNumber from 'bignumber.js';

import type { IAccountToken } from '@onekeyhq/shared/types/token';

export type IDustSweepStage =
  | 'selecting'
  | 'preparing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'left';

export type IDustSweepItemStatus =
  | 'waiting'
  | 'running'
  | 'broadcasted'
  | 'success'
  | 'skipped'
  | 'failed';

export type IDustSweepCandidate = IAccountToken & {
  fiatValue: string;
  balance?: string;
  balanceParsed?: string;
  hidden?: boolean;
};

export type IDustSweepItem = {
  key: string;
  token: IDustSweepCandidate;
  status: IDustSweepItemStatus;
  error?: string;
  receivedAmount?: string;
};

export type IDustSweepSession = {
  sessionId: string;
  owner: {
    accountId: string;
    networkId: string;
    generation: number;
  };
  stage: IDustSweepStage;
  threshold: string;
  targetToken?: IDustSweepCandidate;
  items: IDustSweepItem[];
  selectedKeys: string[];
  activeIndex: number;
  pauseRequested: boolean;
  receivedAmount: string;
  failureMessage?: string;
};

export type IDustSweepAction =
  | {
      type: 'hydrate';
      candidates: IDustSweepCandidate[];
      generation: number;
      accountId?: string;
      networkId?: string;
    }
  | { type: 'toggle'; key: string }
  | { type: 'toggle_all' }
  | { type: 'add_hidden' }
  | { type: 'start'; targetToken: IDustSweepCandidate }
  | { type: 'begin_item'; key: string }
  | { type: 'broadcast_item'; key: string }
  | { type: 'settle_item'; key: string; receivedAmount: string }
  | { type: 'skip_item'; key: string; reason?: string }
  | { type: 'fail_item'; key: string; reason?: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'leave' }
  | { type: 'reset' };

export const initialDustSweepSession: IDustSweepSession = {
  sessionId: '',
  owner: { accountId: '', networkId: '', generation: 0 },
  stage: 'selecting',
  threshold: '0.01',
  items: [],
  selectedKeys: [],
  activeIndex: -1,
  pauseRequested: false,
  receivedAmount: '0',
};

function replaceItem(
  state: IDustSweepSession,
  key: string,
  update: (item: IDustSweepItem) => IDustSweepItem,
) {
  return state.items.map((item) => (item.key === key ? update(item) : item));
}

function selectedItems(state: IDustSweepSession) {
  return state.items.filter((item) => state.selectedKeys.includes(item.key));
}

function isCurrentItem(state: IDustSweepSession, key: string) {
  return (
    state.activeIndex >= 0 &&
    selectedItems(state)[state.activeIndex]?.key === key
  );
}

function canAcceptItemAction(state: IDustSweepSession, key: string) {
  return state.stage === 'running' && isCurrentItem(state, key);
}

function getStageAfterItem(
  state: IDustSweepSession,
  done: boolean,
): IDustSweepStage {
  if (done) return 'completed';
  if (state.pauseRequested) return 'paused';
  return 'running';
}

export function dustSweepReducer(
  state: IDustSweepSession,
  action: IDustSweepAction,
): IDustSweepSession {
  switch (action.type) {
    case 'hydrate': {
      const items = action.candidates.map((token) => ({
        key: token.$key,
        token,
        status: 'waiting' as const,
      }));
      return {
        ...initialDustSweepSession,
        owner: {
          accountId: action.accountId ?? state.owner.accountId,
          networkId: action.networkId ?? state.owner.networkId,
          generation: action.generation,
        },
        items,
      };
    }
    case 'toggle': {
      if (state.stage !== 'selecting') return state;
      const selectedKeys = state.selectedKeys.includes(action.key)
        ? state.selectedKeys.filter((key) => key !== action.key)
        : [...state.selectedKeys, action.key];
      return { ...state, selectedKeys };
    }
    case 'toggle_all': {
      if (state.stage !== 'selecting') return state;
      const selectableKeys = state.items
        .filter((item) => !item.token.hidden)
        .map((item) => item.key);
      const allSelected = selectableKeys.every((key) =>
        state.selectedKeys.includes(key),
      );
      return {
        ...state,
        selectedKeys: allSelected
          ? state.selectedKeys.filter((key) => !selectableKeys.includes(key))
          : [...new Set([...state.selectedKeys, ...selectableKeys])],
      };
    }
    case 'add_hidden': {
      if (state.stage !== 'selecting') return state;
      return {
        ...state,
        selectedKeys: [
          ...new Set([
            ...state.selectedKeys,
            ...state.items
              .filter((item) => item.token.hidden)
              .map((item) => item.key),
          ]),
        ],
      };
    }
    case 'start': {
      if (state.stage !== 'selecting' || state.selectedKeys.length === 0)
        return state;
      return {
        ...state,
        stage: 'preparing',
        targetToken: action.targetToken,
        sessionId: `${state.owner.accountId}:${
          state.owner.networkId
        }:${Date.now()}`,
        activeIndex: 0,
      };
    }
    case 'begin_item':
      return state.stage === 'preparing' ||
        (state.stage === 'running' && isCurrentItem(state, action.key))
        ? {
            ...state,
            stage: 'running',
            activeIndex: selectedItems(state).findIndex(
              (item) => item.key === action.key,
            ),
            items: replaceItem(state, action.key, (item) => ({
              ...item,
              status: 'running',
              error: undefined,
            })),
          }
        : state;
    case 'broadcast_item':
      return canAcceptItemAction(state, action.key)
        ? {
            ...state,
            items: replaceItem(state, action.key, (item) => ({
              ...item,
              status: 'broadcasted',
            })),
          }
        : state;
    case 'settle_item': {
      if (!canAcceptItemAction(state, action.key)) return state;
      const items = replaceItem(state, action.key, (item) => ({
        ...item,
        status: 'success',
        receivedAmount: action.receivedAmount,
      }));
      const receivedAmount = new BigNumber(state.receivedAmount)
        .plus(action.receivedAmount)
        .toFixed();
      const nextIndex = state.activeIndex + 1;
      const done = nextIndex >= selectedItems({ ...state, items }).length;
      return {
        ...state,
        items,
        receivedAmount,
        activeIndex: done ? -1 : nextIndex,
        stage: getStageAfterItem(state, done),
        pauseRequested: false,
      };
    }
    case 'skip_item': {
      if (!canAcceptItemAction(state, action.key)) return state;
      const items = replaceItem(state, action.key, (item) => ({
        ...item,
        status: 'skipped',
        error: action.reason,
      }));
      const nextIndex = state.activeIndex + 1;
      const done = nextIndex >= selectedItems({ ...state, items }).length;
      return {
        ...state,
        items,
        activeIndex: done ? -1 : nextIndex,
        stage: getStageAfterItem(state, done),
        pauseRequested: false,
      };
    }
    case 'fail_item':
      return canAcceptItemAction(state, action.key)
        ? {
            ...state,
            stage: 'paused',
            failureMessage: action.reason,
            items: replaceItem(state, action.key, (item) => ({
              ...item,
              status: 'failed',
              error: action.reason,
            })),
          }
        : state;
    case 'pause':
      return state.stage === 'running'
        ? { ...state, pauseRequested: true }
        : state;
    case 'resume':
      return state.stage === 'paused'
        ? {
            ...state,
            stage: 'running',
            pauseRequested: false,
            failureMessage: undefined,
            items: state.items.map((item) =>
              item.status === 'failed'
                ? { ...item, status: 'waiting', error: undefined }
                : item,
            ),
          }
        : state;
    case 'leave':
      return state.stage === 'completed' || state.stage === 'left'
        ? state
        : { ...state, stage: 'left', pauseRequested: false };
    case 'reset':
      return { ...initialDustSweepSession, owner: state.owner };
    default:
      return state;
  }
}

export function getDustSweepSelectionSummary(state: IDustSweepSession) {
  const selectableCount = state.items.filter(
    (item) => !item.token.hidden,
  ).length;
  const selectedCount = state.selectedKeys.length;
  return {
    selectedCount,
    selectableCount,
    allSelected: selectableCount > 0 && selectedCount >= selectableCount,
    indeterminate: selectedCount > 0 && selectedCount < selectableCount,
  };
}

export function getDustSweepProgress(state: IDustSweepSession) {
  const selected = selectedItems(state);
  return {
    total: selected.length,
    completed: selected.filter((item) =>
      ['success', 'skipped', 'failed'].includes(item.status),
    ).length,
    success: selected.filter((item) => item.status === 'success').length,
    skipped: selected.filter((item) => item.status === 'skipped').length,
    failed: selected.filter((item) => item.status === 'failed').length,
  };
}
