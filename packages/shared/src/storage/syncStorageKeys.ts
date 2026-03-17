// sync storage does not support extension background. Most keys are for
// development, but some (e.g. onekey_pending_install_task) are used in
// production on mobile/desktop.
export enum EAppSyncStorageKeys {
  rrt = 'rrt',
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
}

// Dev setting keys stored in the separate 'onekey-app-dev-setting' MMKV instance,
// readable by native code (app update / bundle update) to control verification behavior.
export enum EDevSettingSyncStorageKeys {
  onekey_developer_mode_enabled = 'onekey_developer_mode_enabled',
  onekey_bundle_skip_gpg_verification = 'onekey_bundle_skip_gpg_verification',
}
