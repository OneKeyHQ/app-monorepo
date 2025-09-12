// Simplified security configuration - no longer needed since API provides riskType directly
// Keeping minimal config for potential future use

export interface ISecurityConfig {
  // Future: Add any global security display settings here if needed
  hideSecurityAlertKeys?: string[];
}

// Minimal security configuration
export const DEFAULT_SECURITY_CONFIG: ISecurityConfig = {
  // Keep this for compatibility, but may remove entirely in the future
  hideSecurityAlertKeys: [],
};

// Get security configuration (simplified - most logic now handled by riskType)
export const getSecurityConfig = (): ISecurityConfig => {
  return DEFAULT_SECURITY_CONFIG;
};
