// cspell: words unifold Unifold
const importUnifoldDepositModals = () =>
  import('../components/TradingPanel/modals/UnifoldDeposit/showUnifoldDepositModals');

type IUnifoldDepositModalsModule = Awaited<
  ReturnType<typeof importUnifoldDepositModals>
>;

let unifoldDepositModalsPromise:
  | Promise<IUnifoldDepositModalsModule>
  | undefined;

// Keeps the Unifold deposit UI out of the main bundle: the chunk is only
// fetched the first time a user opens the deposit entry.
export function loadPerpsUnifoldDepositModals() {
  if (!unifoldDepositModalsPromise) {
    unifoldDepositModalsPromise = importUnifoldDepositModals().catch(
      (error) => {
        unifoldDepositModalsPromise = undefined;
        throw error;
      },
    );
  }
  return unifoldDepositModalsPromise;
}
