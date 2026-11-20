export type IWalletConnectModalShared = {
  useModal: (suspended: boolean) => {
    modal: JSX.Element | null;
    openModal: ({
      uri,
      attemptId,
    }: {
      uri: string;
      attemptId?: number;
    }) => Promise<void>;
    closeModal: () => void;
  };
};
