// sync storage does not support extension background, don't use it in production, but only for development
export enum EAppSyncStorageKeys {
  rrt = 'rrt',
  perf_switch = 'perf_switch',
  onekey_webembed_config = 'onekey_webembed_config',
  onekey_disable_bg_api_serializable_checking = 'onekey_disable_bg_api_serializable_checking',
  onekey_perf_timer_log_config = 'onekey_perf_timer_log_config',
  onekey_debug_render_tracker = 'onekey_debug_render_tracker',
  onekey_db_perf_monitor = 'onekey_db_perf_monitor',
  onekey_developer_mode_enabled = 'onekey_developer_mode_enabled',
}
