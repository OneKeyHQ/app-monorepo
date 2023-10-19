import { createSlice } from '@reduxjs/toolkit';

import type { WalletHomeTabEnum } from '../../views/Wallet/type';
import type { PayloadAction } from '@reduxjs/toolkit';

export type IRpcStatus =
  | {
      latestBlock?: number;
      responseTime?: number;
      updatedAt?: number;
      rpcBatchSupported?: boolean;
    }
  | undefined;

export type StatusState = {
  isUnlock: boolean;
  boardingCompleted: boolean;
  webviewGlobalKey: number;
  authenticationType?: 'FINGERPRINT' | 'FACIAL';
  hideAddressBookAttention?: boolean;
  homeTabName?: WalletHomeTabEnum;
  swapPopoverShown?: boolean;
  guideToPushFirstTime?: boolean;
  firstTimeShowCheckRPCNodeTooltip?: boolean;
  autoSwitchDefaultRpcAtVersion?: string;
  userSwitchedNetworkRpcFlag?: Record<string, boolean>;
  rpcStatus?: Record<string, IRpcStatus>;
};

const initialState: StatusState = {
  isUnlock: false,
  boardingCompleted: false,
  webviewGlobalKey: 0,
  hideAddressBookAttention: false,
  homeTabName: undefined,
  swapPopoverShown: false,
  guideToPushFirstTime: false,
  firstTimeShowCheckRPCNodeTooltip: false,
  autoSwitchDefaultRpcAtVersion: undefined,
  userSwitchedNetworkRpcFlag: {},
};

export const slice = createSlice({
  name: 'status',
  initialState,
  reducers: {
    setHomeTabName(state, action: PayloadAction<WalletHomeTabEnum>) {
      state.homeTabName = action.payload;
    },
    setBoardingCompleted: (state) => {
      state.boardingCompleted = true;
    },
    setBoardingNotCompleted: (state) => {
      state.boardingCompleted = false;
    },
    setAuthenticationType(
      state,
      action: PayloadAction<'FINGERPRINT' | 'FACIAL'>,
    ) {
      state.authenticationType = action.payload;
    },
    unlock: (state) => {
      state.isUnlock = true;
    },
    lock: (state) => {
      state.isUnlock = false;
    },
    refreshWebviewGlobalKey: (state) => {
      state.webviewGlobalKey = Date.now();
    },
    setHideAddressBookAttention: (state) => {
      state.hideAddressBookAttention = true;
    },
    setSwapPopoverShown: (state) => {
      state.swapPopoverShown = true;
    },
    setGuideToPushFistTime: (state, action: PayloadAction<boolean>) => {
      state.guideToPushFirstTime = action.payload;
    },
    setFistTimeShowCheckRPCNodeTooltip: (
      state,
      action: PayloadAction<boolean>,
    ) => {
      state.firstTimeShowCheckRPCNodeTooltip = action.payload;
    },
    updateAutoSwitchDefaultRpcAtVersion: (
      state,
      action: PayloadAction<string>,
    ) => {
      state.autoSwitchDefaultRpcAtVersion = action.payload;
    },
    updateUserSwitchNetworkFlag: (
      state,
      action: PayloadAction<{ networkId: string; flag: boolean }>,
    ) => {
      const { networkId, flag } = action.payload;
      let map = state.userSwitchedNetworkRpcFlag;
      if (!map || typeof map !== 'object') {
        map = {};
      }
      map[networkId] = flag;
      state.userSwitchedNetworkRpcFlag = map;
    },
    setRpcStatus(
      state,
      action: PayloadAction<{ networkId: string; status: IRpcStatus }>,
    ) {
      const { networkId, status } = action.payload;
      if (!state.rpcStatus) {
        state.rpcStatus = {};
      }
      const current = state.rpcStatus[networkId];
      if (
        status?.responseTime === current?.responseTime &&
        status?.latestBlock === current?.latestBlock
      ) {
        return;
      }
      state.rpcStatus[networkId] = {
        ...status,
        updatedAt: Date.now(),
      };
    },
  },
});

export const {
  setBoardingCompleted,
  setBoardingNotCompleted,
  setAuthenticationType,
  lock,
  unlock,
  refreshWebviewGlobalKey,
  setHideAddressBookAttention,
  setHomeTabName,
  setSwapPopoverShown,
  setGuideToPushFistTime,
  setFistTimeShowCheckRPCNodeTooltip,
  updateAutoSwitchDefaultRpcAtVersion,
  updateUserSwitchNetworkFlag,
  setRpcStatus,
} = slice.actions;

export default slice.reducer;
