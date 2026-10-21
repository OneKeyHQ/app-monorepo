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
  starknet_privacy_error_proof_expired = 'This private transfer expired before it was submitted. Build it again.',
  starknet_privacy_error_screening_window_expired = 'This deposit was submitted outside its screening window. Build it again.',
  starknet_privacy_error_pool_paused = 'Private transfers are paused by the protocol.',
  starknet_privacy_error_key_mismatch = 'The registered private-transfer key does not match this device. Do not register again; contact support.',
  starknet_privacy_error_locked = 'Unlock the app to read your private balance.',
  starknet_privacy_error_unavailable = 'Private transfers are not available on this network yet.',
  starknet_privacy_error_recipient_not_registered = 'This address has not enabled private transfers.',
  starknet_privacy_error_invalid_amount = 'Enter a valid amount.',
  starknet_privacy_error_unknown = 'Private transfers hit an unexpected error.',

  // status
  starknet_privacy_status_off = 'Private transfers off',
  starknet_privacy_status_pending = 'Enabling private transfers',
  starknet_privacy_status_on = 'Private transfers on',
  starknet_privacy_status_mismatch = 'Private transfers need attention',
  starknet_privacy_status_waiting = 'Waiting {blocks} blocks before the next private transfer',

  // consent
  starknet_privacy_consent_title = 'Enable private transfers',
  starknet_privacy_consent_viewing_key = 'Your viewing key is sent in plain text to the protocol operator every time your private balance syncs and on every private transfer. Network-level encryption hides it from the network, not from the operator.',
  starknet_privacy_consent_registration = 'Registering writes your viewing key on-chain, encrypted to this pool auditor. It is written once and cannot be changed or removed.',
  starknet_privacy_consent_withdrawals = 'Withdrawals also encrypt the initiating address to the auditor.',
  starknet_privacy_consent_fee = 'Each private transfer costs a protocol fee of {amount} STRK on top of network fees.',
  starknet_privacy_consent_acknowledge = 'I understand this cannot be undone',
  starknet_privacy_consent_auditor_key = 'Auditor key: {key}',
  starknet_privacy_opt_out_note = 'Turning this off stops syncing on this device only. The on-chain registration stands.',

  // ---- starknet privacy (UI)
  // labels
  starknet_privacy_private_transfers = 'Private transfers',
  starknet_privacy_balance_public = 'Public',
  starknet_privacy_balance_private = 'Private',
  starknet_privacy_balance_total = 'Total',

  // actions
  starknet_privacy_action_enable = 'Enable',
  starknet_privacy_action_deposit = 'Deposit to private',
  starknet_privacy_action_withdraw = 'Withdraw to public',
  starknet_privacy_action_send_private = 'Send privately',

  // token details block
  starknet_privacy_block_enable_desc = 'Move this token into the private pool to send and receive it without publishing the amount on-chain.',
  starknet_privacy_block_pending_desc = 'Your registration transaction is waiting to confirm.',
  starknet_privacy_wait_countdown = 'Next private transfer available in {blocks} blocks, about {duration}.',

  // private transfer form
  starknet_privacy_form_desc_deposit = 'Moves {symbol} from your public balance into the private pool.',
  starknet_privacy_form_desc_withdraw = 'Moves {symbol} from the private pool back to your public balance.',
  starknet_privacy_form_desc_transfer = 'Sends {symbol} from the private pool to another address that has enabled private transfers.',
  starknet_privacy_available_private = 'Private {amount} {symbol}',
  starknet_privacy_available_public = 'Public {amount} {symbol}',
  starknet_privacy_amount_required = 'Enter an amount',
  starknet_privacy_amount_exceeds_available = 'Amount is more than the available balance',
  starknet_privacy_recipient_setup_note = 'The first private transfer to this address also performs one-time setup, so it costs more.',

  // confirm screen banners
  starknet_privacy_banner_protocol_fee = 'A protocol fee of {amount} STRK applies to this private transfer, on top of the network fee.',
  starknet_privacy_banner_screening_window = 'This deposit has a short compliance screening window. If you wait too long before confirming, build it again.',
  starknet_privacy_warning_user_linkage = 'This transfer opens more than one private channel at once, which links the recipients to each other on-chain.',

  // receive and history
  starknet_privacy_receive_note = 'Incoming transfers arrive private or public depending on what the sender chooses.',
  starknet_privacy_history_not_authoritative = 'Private transfer history is rebuilt from your own notes, so it is incomplete by design. Entries can be missing, and a withdrawal that shared a transaction with your notes can appear here even when it was not yours.',
}
