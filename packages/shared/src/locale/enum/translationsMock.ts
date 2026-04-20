export enum ETranslationsMock {
  mock_do_not_delete_this_key = 'mock',

  // ----------------------------------------------
  v4_migration_input_v4_password = 'Enter v4 password',
  v4_migration_input_v4_password_desc = 'Your v5 password has been changed, please enter your v4 password to continue',
  // ----------------------------------------------
  unavailable_networks_for_selected_account = 'Unavailable networks for selected account',
  testnet = 'Testnet',
  // ----------------------------------------------
  // Third-party hardware — generic errors
  hardware_third_party_app_not_installed = 'Please open the correct app on your device',
  hardware_third_party_device_locked = 'Device is locked, please unlock',
  hardware_third_party_user_rejected = 'Operation rejected on device',
  hardware_third_party_wrong_app = 'Wrong app is open on device',
  hardware_third_party_device_disconnected = 'Device disconnected',
  hardware_third_party_device_mismatch = 'Connected device does not match the stored wallet',
  hardware_third_party_operation_timeout = 'Operation timed out',
  hardware_third_party_method_not_supported = 'This operation is not supported',
  hardware_third_party_unknown_error = 'Unknown hardware error. Please try again.',
  hardware_third_party_device_not_found = 'No device detected. Please plug in via USB or enable Bluetooth.',
  hardware_third_party_device_busy = 'Device is in use by another app. Close Ledger Live and try again.',
  hardware_third_party_transport_error = 'Hardware communication failed. Check the USB cable or Bluetooth and try again.',
  hardware_third_party_transport_not_available = 'Your browser or platform does not support connecting to this hardware wallet.',
  // ----------------------------------------------
  // Third-party hardware (Ledger) — EVM Eth App errors
  hardware_third_party_evm_blind_signing_required = 'Please enable Blind signing on your Ledger: open the Ethereum app → Settings → Blind signing → Enabled, then try again.',
  hardware_third_party_evm_clear_sign_plugin_missing = 'Required Ledger plugin is not installed. Please install the matching plugin on Ledger Live, then try again.',
  hardware_third_party_evm_data_too_large = 'Transaction data is too large for your Ledger device. Try a simpler transaction or use a Ledger with more memory.',
  hardware_third_party_evm_tx_type_not_supported = 'Transaction type is not supported by your Ledger Ethereum app. Please update the app to the latest version.',
  hardware_third_party_app_too_old = 'Your Ledger app is out of date. Please update it via Ledger Live.',
  // ----------------------------------------------
  // Third-party hardware — UI labels (no ICU placeholders in mock phase)
  hardware_third_party_default_device_label = 'Device',
  hardware_third_party_device_not_found_title = 'Device Not Found',
  hardware_third_party_device_scan_error = 'Failed to scan for devices. Please try again.',
  hardware_third_party_no_app_installed_on_device = 'No apps installed on your device. Please install apps via Ledger Live.',
  hardware_third_party_connect_ledger_message = 'Please connect and unlock your Ledger device',
  // ----------------------------------------------
  // Third-party hardware (Ledger) — onboarding / connection flow steps
  hardware_third_party_connect_step_usb = 'Connect your Ledger to the computer via USB',
  hardware_third_party_connect_step_ble = 'Turn on Bluetooth on your phone and keep Ledger nearby',
  hardware_third_party_connect_step_power_on_and_unlock = 'Power on and unlock your Ledger',
}
