export enum ETranslationsMock {
  mock_do_not_delete_this_key = 'mock',

  // ----------------------------------------------
  v4_migration_input_v4_password = 'Enter v4 password',
  v4_migration_input_v4_password_desc = 'Your v5 password has been changed, please enter your v4 password to continue',
  // ----------------------------------------------
  unavailable_networks_for_selected_account = 'Unavailable networks for selected account',
  testnet = 'Testnet',
  prime_gift_title = 'Claim Prime',
  prime_gift_offer = '{count} months of Prime included',
  prime_gift_claim = 'Claim {count} months of Prime',
  prime_gift_thanks = 'Thank you for choosing OneKey',
  prime_gift_later = 'You can claim later in device details',
  prime_gift_once = 'Each device can claim once. Each month equals 30 days.',
  prime_gift_device_once = 'Each device can claim once',
  prime_gift_invite__action = 'Have an invite code? Enter it',
  prime_gift_benefits = 'Explore benefits',
  prime_gift_eligibility = 'Claim eligibility',
  prime_gift_eligible = 'Eligible to claim',
  prime_gift_claimed = 'This device has already claimed Prime',
  prime_gift_unavailable = 'This offer is not available',
  prime_gift_account = 'Sign in to OneKey ID',
  prime_gift_account_desc = 'Choose the account that will receive Prime',
  prime_gift_login = 'Sign in and continue',
  prime_gift_verify = 'Verify device',
  prime_gift_verify_desc = 'Device verification is required before claiming',
  prime_gift_verify_claim = 'Verify device and claim',
  prime_gift_success = 'Prime claimed',
  prime_gift_months = '{count} months of Prime',
  prime_gift_processing = 'Verifying device and redeeming Prime',
  prime_gift_retry = 'Check status and retry',
  prime_gift_error = 'Unable to confirm your claim. Check the status and try again.',
  prime_gift_loading = 'Checking eligibility',
  prime_gift_verified = 'Verified',
  prime_gift_session_changed = 'Your account changed. Confirm the receiving account to continue.',
  prime_gift_result_unknown = 'Your previous claim is not yet confirmed. Retrying will use the same redemption code.',
  cloud_sync_hardware_endpoint_mismatch__desc = 'To resume syncing, switch back to the previous API node in Settings > Developer. Your existing sync key and data are kept.',
  // ----------------------------------------------

  // ---- starknet
  starknet_account_activation_one_time = 'Account activation',
  starknet_account_deployed_transfer_failed = 'Your Starknet account was activated, but the transfer was not sent. Please try the transfer again.',

  // ---- starknet privacy
  // Privacy errors
  starknet_privacy_error_screening_rejected = 'Compliance screening declined this deposit.',
  starknet_privacy_error_proving_quota = "Today's private-transfer quota is used up. Try again tomorrow.",
  starknet_privacy_error_pool_paused = 'Private transfers are paused by the protocol.',
  starknet_privacy_error_key_mismatch = 'The registered private-transfer key does not match this device. Do not register again; contact support.',
  starknet_privacy_error_waiting = 'Wait for the current transaction and network cooldown before preparing another.',
  starknet_privacy_error_recipient_not_registered = 'This address has not enabled private transfers.',

  // confirmation
  starknet_privacy_warning_user_linkage = 'This transfer opens more than one private channel at once, which links the recipients to each other on-chain.',
}
