// sync storage does not support extension background. Most keys are for
// development, but some (e.g. onekey_pending_install_task) are used in
// production on mobile/desktop.
export enum EAppSyncStorageKeys {
  perf_switch = 'perf_switch',
  onekey_webembed_config = 'onekey_webembed_config',
  onekey_disable_bg_api_serializable_checking = 'onekey_disable_bg_api_serializable_checking',
  onekey_perf_timer_log_config = 'onekey_perf_timer_log_config',
  onekey_debug_render_tracker = 'onekey_debug_render_tracker',
  onekey_db_perf_monitor = 'onekey_db_perf_monitor',
  onekey_developer_mode_enabled = 'onekey_developer_mode_enabled',
  onekey_pending_install_task = 'onekey_pending_install_task',
  last_onekey_id_login_email = 'last_onekey_id_login_email',
  last_scan_qr_code_text = 'last_scan_qr_code_text',
  onekey_whats_new_shown = 'onekey_whats_new_shown',
  last_valid_server_time = 'last_valid_server_time',
  last_valid_local_time = 'last_valid_local_time',
  onekey_jotai_context_atoms_snapshot = 'onekey_jotai_context_atoms_snapshot',
  onekey_account_selector_recent_selection = 'onekey_account_selector_recent_selection',
  onekey_swr_cache = 'onekey_swr_cache',
  onekey_device_performance_tier = 'onekey_device_performance_tier',
  // TokenList cells one-time cold-start cleanup version flag (spec §7). A
  // monotonically-increasing integer compared against
  // TOKEN_COLD_START_CLEANUP_VERSION so the OLD `::ctx:renderedTokenListCacheAtom`
  // disk fields are purged once per version (and re-purged after a
  // downgrade→upgrade). Stored in the cold-start cache MMKV instance.
  onekey_tokenlist_cold_start_cleanup_version = 'onekey_tokenlist_cold_start_cleanup_version',
}

// Dev setting keys stored in the separate 'onekey-app-dev-setting' MMKV instance,
// readable by native code (app update / bundle update) to control verification behavior.
export enum EDevSettingSyncStorageKeys {
  onekey_developer_mode_enabled = 'onekey_developer_mode_enabled',
  onekey_bundle_skip_gpg_verification = 'onekey_bundle_skip_gpg_verification',
  onekey_native_network_throttle_enabled = 'onekey_native_network_throttle_enabled',
}

// Logical "scope" identifiers used when caching lists that are surfaced by
// more than one UI variant. Each scope is an independent slot inside
// `onekey_swr_cache`. Keep the value strings stable: changing one
// invalidates every cached entry for that scope.
export enum EAppSWRCacheScopes {
  editableChainSelector = 'editable-chain-selector',
  pureChainSelector = 'pure-chain-selector',
}
