import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export type DappSiteInfo = {
  origin: string;
  icon?: string;
  name?: string;
};

export type DappSiteConnectionSavePayload = {
  site: DappSiteInfo;
  networkImpl: string;
  address: string;
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

export const { dappSaveSiteConnection, dappClearSiteConnection } =
  dappSlicer.actions;

export default dappSlicer.reducer;
