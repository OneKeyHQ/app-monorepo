import { createContext, useContext } from "react";

import type { IToken, ITokenFiat } from "@onekeyhq/shared/types/token";
import { EBulkSendMode } from "@onekeyhq/shared/types/bulkSend";

export type IBulkSendAmountsInputContext = {
  accountId: string | undefined;
  networkId: string;
  tokenDetails: ({ info: IToken } & ITokenFiat) | undefined;
  setTokenDetails: (tokenDetails: ({ info: IToken } & ITokenFiat) | undefined) => void;
  tokenDetailsState: {
    initialized: boolean;
    isRefreshing: boolean;
  };
  setTokenDetailsState: (state: { initialized: boolean; isRefreshing: boolean }) => void;
  bulkSendMode: EBulkSendMode;
  senders: { address: string; amount: string | undefined }[];
  receivers: { address: string; amount: string | undefined }[];
};
export const BulkSendAmountsInputContext = createContext<IBulkSendAmountsInputContext>({
  accountId: undefined,
  networkId: "",
  tokenDetails: undefined,
  setTokenDetails: () => {},
  tokenDetailsState: {
    initialized: false,
    isRefreshing: false,
  },
  setTokenDetailsState: () => {},
  bulkSendMode: EBulkSendMode.OneToMany,
  senders: [],
  receivers: [],
});

export const useBulkSendAmountsInputContext = () => useContext(BulkSendAmountsInputContext);
