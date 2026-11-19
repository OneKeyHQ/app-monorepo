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
  // ----------------------------------------------

  // ---- starknet
  starknet_account_activation_one_time = 'Account activation (one-time)',
  starknet_account_deploy_wallet = 'Deploy wallet',
  starknet_account_deployed_transfer_failed = 'Your Starknet account was activated, but the transfer was not sent. Please try the transfer again.',

  // ---- starknet privacy
  // errors, one per row of the STRK20 mapping table
  starknet_privacy_error_screening_rejected = 'Compliance screening declined this deposit.',
  starknet_privacy_error_screening_unavailable = 'Compliance screening is temporarily unavailable. Try again shortly.',
  starknet_privacy_error_reorg = 'The network reorganized. Refreshing your private balance.',
  starknet_privacy_error_proving_behind = 'The proving service is behind the chain. Try again shortly.',
  starknet_privacy_error_proving_validation = 'The proving service rejected the signature. Try again.',
  starknet_privacy_error_version_mismatch = 'Private transfers need a newer app version.',
  starknet_privacy_error_internal = 'Private transfers hit an internal error. Please report this.',
  starknet_privacy_error_service_busy = 'The proving service is busy. Try again shortly.',
  starknet_privacy_error_proving_quota = "Today's private-transfer quota is used up. Try again tomorrow.",
  starknet_privacy_error_proving_unauthorized = "The proving service rejected this app's credentials.",
  starknet_privacy_error_proving_delivery_unknown = 'The proving service could not confirm this request. Build the transfer again.',
  starknet_privacy_error_proving_timeout = 'Proof generation took too long. Try again.',
  starknet_privacy_error_service_overloaded = 'The privacy service is overloaded. Try again shortly.',
  starknet_privacy_error_request_rejected = 'The proving service could not process this transfer.',
  starknet_privacy_error_proof_expired = 'This transaction expired. Go back and prepare it again.',
  starknet_privacy_error_screening_window_expired = 'This deposit is no longer valid. Go back and prepare it again.',
  starknet_privacy_error_pool_paused = 'Private transfers are paused by the protocol.',
  starknet_privacy_error_key_mismatch = 'The registered private-transfer key does not match this device. Do not register again; contact support.',
  starknet_privacy_error_waiting = 'Wait for the current transaction and network cooldown before preparing another.',
  starknet_privacy_error_balance = 'Unable to load the available balance. Refresh to continue.',
  starknet_privacy_error_history = 'Unable to sync private history. Retry to load transactions.',
  starknet_privacy_error_fee = 'Unable to load the protocol fee. Retry before preparing a transaction.',
  starknet_privacy_error_unavailable = 'Private transfers are not available on this network yet.',
  starknet_privacy_error_recipient_not_registered = 'This address has not enabled private transfers.',
  starknet_privacy_error_invalid_amount = 'Enter a valid amount.',
  starknet_privacy_error_unknown = 'Private transfers hit an unexpected error.',

  // status
  starknet_privacy_activation_title = 'Enable Starknet privacy',
  starknet_privacy_activation_failed_title = 'Privacy registration failed',
  starknet_privacy_activation_pending_title = 'Waiting for confirmation',
  starknet_privacy_activation_check = 'Check status',
  starknet_privacy_activation_checking = 'Checking registration…',
  starknet_privacy_unlock_sync = 'Unlock and sync',
  starknet_privacy_resume_sync = 'Resume private sync',
  starknet_privacy_resume_no_fee = 'Restoring sync does not create a transaction or charge a fee.',
  starknet_privacy_status_waiting = 'Waiting {blocks} blocks before the next private transfer',

  // consent
  starknet_privacy_consent_title = 'Enable private transfers',
  starknet_privacy_consent_visibility_title = 'Who can view activity',
  starknet_privacy_consent_visibility = 'Sync and proving services receive your viewing key and can read your private activity. The pool auditor can also view it. This key cannot authorize spending.',
  starknet_privacy_consent_registration_title = 'Permanent registration',
  starknet_privacy_consent_public_activity = 'Deposit and withdrawal addresses and amounts remain public.',
  starknet_privacy_consent_viewing_key = 'Your viewing key is sent in plain text to the protocol operator every time your private balance syncs and on every private transfer.',
  starknet_privacy_consent_registration = 'Registering writes your viewing key on-chain, encrypted to this pool auditor. It is written once and cannot be changed or removed.',
  starknet_privacy_consent_withdrawals = 'Withdrawals also encrypt the initiating address to the auditor.',
  starknet_privacy_consent_fee_label = 'Current protocol fee',
  starknet_privacy_consent_fee = '{amount} STRK per operation',
  starknet_privacy_consent_acknowledge = 'I understand who can view my activity and that registration is permanent.',
  starknet_privacy_consent_auditor_key = 'Auditor key: {key}',
  starknet_privacy_consent_auditor_key_label = 'Auditor public key',

  // ---- starknet privacy (UI)
  // labels
  starknet_privacy_balance_public = 'Public',
  starknet_privacy_balance_private = 'Private',
  starknet_privacy_balance_total = 'Total',

  // actions
  starknet_privacy_action_enable = 'Enable',
  starknet_privacy_action_deposit = 'Deposit to private',
  starknet_privacy_action_withdraw = 'Withdraw to public',
  starknet_privacy_action_send_private = 'Send privately',

  // token details block
  starknet_privacy_wait_countdown = 'Next private transfer available in {blocks} blocks, about {duration}.',

  // private transfer form
  starknet_privacy_available_private = 'Private {amount} {symbol}',
  starknet_privacy_available_public = 'Public {amount} {symbol}',
  starknet_privacy_amount_required = 'Enter an amount',
  starknet_privacy_amount_precision = 'Use no more than {decimals} decimal places.',
  starknet_privacy_amount_exceeds_available = 'Amount is more than the available balance',

  // confirmation
  starknet_privacy_estimated_total_fee = 'Est. total fee',
  starknet_privacy_warning_user_linkage = 'This transfer opens more than one private channel at once, which links the recipients to each other on-chain.',
}
