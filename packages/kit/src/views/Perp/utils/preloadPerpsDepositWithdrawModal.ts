const importPerpsDepositWithdrawModal = () =>
  import('../components/TradingPanel/modals/DepositWithdrawModal');

type IPerpsDepositWithdrawModalModule = Awaited<
  ReturnType<typeof importPerpsDepositWithdrawModal>
>;

let depositWithdrawModalModule: IPerpsDepositWithdrawModalModule | undefined;
let depositWithdrawModalPromise:
  | Promise<IPerpsDepositWithdrawModalModule>
  | undefined;

export function loadPerpsDepositWithdrawModal() {
  if (!depositWithdrawModalPromise) {
    depositWithdrawModalPromise = importPerpsDepositWithdrawModal()
      .then((module) => {
        depositWithdrawModalModule = module;
        return module;
      })
      .catch((error) => {
        depositWithdrawModalPromise = undefined;
        throw error;
      });
  }
  return depositWithdrawModalPromise;
}

export function getLoadedPerpsDepositWithdrawModal() {
  return depositWithdrawModalModule;
}

export function preloadPerpsDepositWithdrawModal() {
  return loadPerpsDepositWithdrawModal();
}
