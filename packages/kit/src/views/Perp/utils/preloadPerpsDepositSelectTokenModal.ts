const importPerpsDepositSelectTokenModal = () =>
  import('../components/TradingPanel/modals/DepositSelectTokenModal');

type IPerpsDepositSelectTokenModalModule = Awaited<
  ReturnType<typeof importPerpsDepositSelectTokenModal>
>;

let depositSelectTokenModalModule:
  | IPerpsDepositSelectTokenModalModule
  | undefined;
let depositSelectTokenModalPromise:
  | Promise<IPerpsDepositSelectTokenModalModule>
  | undefined;

export function loadPerpsDepositSelectTokenModal() {
  if (!depositSelectTokenModalPromise) {
    depositSelectTokenModalPromise = importPerpsDepositSelectTokenModal()
      .then((module) => {
        depositSelectTokenModalModule = module;
        return module;
      })
      .catch((error) => {
        depositSelectTokenModalPromise = undefined;
        throw error;
      });
  }
  return depositSelectTokenModalPromise;
}

export function getLoadedPerpsDepositSelectTokenModal() {
  return depositSelectTokenModalModule;
}

export function preloadPerpsDepositSelectTokenModal() {
  return loadPerpsDepositSelectTokenModal();
}
