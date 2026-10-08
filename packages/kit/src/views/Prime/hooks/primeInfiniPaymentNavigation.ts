/* cspell:ignore Infini */
export async function closePrimeInfiniPaymentOverlaysAndNavigate({
  closeDialogs,
  closeModals,
  navigate,
}: {
  closeDialogs: () => Promise<void>;
  closeModals: () => Promise<void>;
  navigate: () => void;
}) {
  await closeDialogs();
  await closeModals();
  navigate();
}
