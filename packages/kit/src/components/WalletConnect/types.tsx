export type IWalletConnectModalShared = {
  useModal: () => {
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
