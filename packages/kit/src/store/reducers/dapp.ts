import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { IWalletConnectSession } from '@walletconnect/types';

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
  walletConnectSessions: IWalletConnectSession[];
};

const initialState: DappInitialState = {
  connections: [],
  walletConnectSessions: [],
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
            payload.addresses.length &&
            //  payload.addresses.includes(connc.address) &&
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
    dappUpdateWalletConnectSession(
      state,
      action: PayloadAction<IWalletConnectSession>,
    ) {
      const { payload } = action;
      let sessions = [...state.walletConnectSessions];
      sessions = sessions.map((session) => {
        if (session.peerMeta?.url === payload.peerMeta?.url) {
          Object.assign(session, payload);
        }
        return session;
      });
      sessions = sessions.filter((session) => session.connected);
      state.walletConnectSessions = sessions;
    },
    dappSaveWalletConnectSession(
      state,
      action: PayloadAction<IWalletConnectSession>,
    ) {
      const { payload } = action;
      const sessions = [...state.walletConnectSessions];
      // save only connected session
      if (payload.connected) {
        if (
          sessions.find(
            (session) => session.peerMeta?.url === payload.peerMeta?.url,
          )
        ) {
          this.dappUpdateWalletConnectSession(state, action);
        } else {
          sessions.push(payload);
        }
      }
      state.walletConnectSessions = sessions;
    },
    dappCloseWalletConnectSession(
      state,
      action: PayloadAction<IWalletConnectSession>,
    ) {
      const { payload } = action;
      if (!payload) {
        this.dappClearWalletConnectSession(state);
      } else {
        let sessions = [...state.walletConnectSessions];
        sessions = sessions.filter(
          (session) => session.peerMeta?.url !== payload.peerMeta?.url,
        );
        state.walletConnectSessions = sessions;
      }
    },
    dappClearWalletConnectSession(state) {
      state.walletConnectSessions = [];
    },
  },
});

export const {
  dappSaveSiteConnection,
  dappClearSiteConnection,
  dappRemoveSiteConnections,
  dappUpdateWalletConnectSession,
  dappSaveWalletConnectSession,
  dappCloseWalletConnectSession,
  dappClearWalletConnectSession,
} = dappSlicer.actions;

export default dappSlicer.reducer;
