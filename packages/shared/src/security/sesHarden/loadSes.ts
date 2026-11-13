export default function loadSes(): void {
  // Keep loading lazy so L0 does not initialize SES or modify the realm.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('ses');
}
