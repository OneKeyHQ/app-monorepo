export enum ETranslationsMock {
  mock_do_not_delete_this_key = 'mock',

  // ----------------------------------------------
  v4_migration_input_v4_password = 'Enter v4 password',
  v4_migration_input_v4_password_desc = 'Your v5 password has been changed, please enter your v4 password to continue',
  // ----------------------------------------------
  unavailable_networks_for_selected_account = 'Unavailable networks for selected account',
  testnet = 'Testnet',
  // Shown when a Trezor BLE connect fails with a stale OS bond (BleBondInvalid /
  // insufficient authentication). The user must remove the OS bond manually.
  trezor_ble_bond_invalid__msg = 'This Bluetooth pairing is no longer valid. Forget this device in your system Bluetooth settings, then reconnect.',
}
