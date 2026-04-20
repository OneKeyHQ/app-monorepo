export enum ETranslationsMock {
  mock_do_not_delete_this_key = 'mock',

  // ----------------------------------------------
  v4_migration_input_v4_password = 'Enter v4 password',
  v4_migration_input_v4_password_desc = 'Your v5 password has been changed, please enter your v4 password to continue',
  // ----------------------------------------------
  unavailable_networks_for_selected_account = 'Unavailable networks for selected account',
  testnet = 'Testnet',
  // ----------------------------------------------
  // Third-party hardware (Ledger) — EVM Eth App errors
  hardware_third_party_evm_blind_signing_required = 'Please enable Blind signing on your Ledger: open the Ethereum app → Settings → Blind signing → Enabled, then try again.',
  hardware_third_party_evm_clear_sign_plugin_missing = 'Required Ledger plugin is not installed. Please install the matching plugin on Ledger Live, then try again.',
  hardware_third_party_evm_data_too_large = 'Transaction data is too large for your Ledger device. Try a simpler transaction or use a Ledger with more memory.',
  hardware_third_party_evm_tx_type_not_supported = 'Transaction type is not supported by your Ledger Ethereum app. Please update the app to the latest version.',
  hardware_third_party_app_too_old = 'Your Ledger app is out of date. Please update it via Ledger Live.',
}
