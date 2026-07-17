// cspell: words unifold Unifold
const importPerpsUnifoldDepositModal = () =>
  import('../components/TradingPanel/modals/PerpsUnifoldDepositModal');

type IPerpsUnifoldDepositModalModule = Awaited<
  ReturnType<typeof importPerpsUnifoldDepositModal>
>;

let unifoldDepositModalPromise:
  | Promise<IPerpsUnifoldDepositModalModule>
  | undefined;

// Keeps the Unifold SDK (and its CSS) out of the main bundle: the chunk is
// only fetched the first time a user opens the deposit entry.
export function loadPerpsUnifoldDepositModal() {
  if (!unifoldDepositModalPromise) {
    unifoldDepositModalPromise = importPerpsUnifoldDepositModal().catch(
      (error) => {
        unifoldDepositModalPromise = undefined;
        throw error;
      },
    );
  }
  return unifoldDepositModalPromise;
}
