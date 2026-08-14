export enum EDevicePerformanceTier {
  high = 'high',
  medium = 'medium',
  low = 'low',
}

export const EDeviceCpuTier = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  unknown: 'unknown',
} as const;

export type EDeviceCpuTier =
  (typeof EDeviceCpuTier)[keyof typeof EDeviceCpuTier];

export type TKnownDeviceCpuTier = Exclude<
  EDeviceCpuTier,
  typeof EDeviceCpuTier.unknown
>;

export function isKnownDeviceCpuTier(
  value: unknown,
): value is TKnownDeviceCpuTier {
  return (
    value === EDeviceCpuTier.high ||
    value === EDeviceCpuTier.medium ||
    value === EDeviceCpuTier.low
  );
}

export enum EDeviceMemoryClass {
  constrained = 'constrained',
  standard = 'standard',
  large = 'large',
  unknown = 'unknown',
}

export type IDevicePerformanceProfileSource =
  | 'iosModelId'
  | 'androidModel'
  | 'browserHardwareConcurrency'
  | 'desktopLogicalProcessorCount'
  | 'developerOverride'
  | 'unknown';

export type IDevicePerformanceProfileConfidence = 'high' | 'medium' | 'none';

export interface IDeviceCpuTierMatch {
  tier: TKnownDeviceCpuTier;
  source: IDevicePerformanceProfileSource;
  confidence: IDevicePerformanceProfileConfidence;
}

export interface IDeviceCpuCapability {
  tier: EDeviceCpuTier;
  source: IDevicePerformanceProfileSource;
  confidence: IDevicePerformanceProfileConfidence;
}

export interface IDeviceMemoryCapability {
  class: EDeviceMemoryClass;
  totalGB: number | null;
}

export interface IDevicePerformanceProfile {
  cpu: IDeviceCpuCapability;
  memory: IDeviceMemoryCapability;
  dataVersion: string;
}
