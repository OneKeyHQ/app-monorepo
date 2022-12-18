import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';

export type DappSiteInfo = {
  origin: string;
  hostname?: string;
  icon?: string;
  name?: string;
};

export type DappSiteConnectionSavePayload = {
  site: DappSiteInfo;
  networkImpl: string;
  address: string;
};

export type DappSiteConnectionRemovePayload = {
  origin: string;
  networkImpl: string;
  addresses: string[];
};

export type DappSiteConnection = DappSiteConnectionSavePayload & {
  created: number;
  lastTime: number;
};

export type DappInitialState = {
  connections: DappSiteConnection[];
};

const initialState: DappInitialState = {
  connections: [],
};

export const dappSlicer = createSlice({
  name: 'dapp',
  initialState,
  reducers: {
    dappClearSiteConnection(state) {
      state.connections = [];
    },
    dappRemoveSiteConnections(
      state,
      action: PayloadAction<DappSiteConnectionRemovePayload>,
    ) {
      let connections = [...state.connections];
      const { payload } = action;
      connections = connections.filter(
        (connc) =>
          !(
            payload.origin === connc.site.origin &&
            payload.networkImpl === connc.networkImpl
          ),
      );
      state.connections = connections;
    },
    dappSaveSiteConnection(
      state,
      action: PayloadAction<DappSiteConnectionSavePayload>,
    ) {
      const { payload } = action;
      const connections = [...state.connections];
      let info: DappSiteConnection | undefined = connections.find(
        (item) =>
          item.site.origin === payload.site.origin &&
          item.networkImpl === payload.networkImpl &&
          item.address === payload.address,
      );
      if (!info) {
        info = {
          ...payload,
          created: Date.now(),
          lastTime: Date.now(),
        };
        connections.push(info);
      }
      info.lastTime = Date.now();
      state.connections = connections;
    },
  },
});

export const {
  dappSaveSiteConnection,
  dappClearSiteConnection,
  dappRemoveSiteConnections,
} = dappSlicer.actions;

export default dappSlicer.reducer;
