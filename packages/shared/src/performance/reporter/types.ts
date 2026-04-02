/**
 * Performance monitoring types
 */

export type IPerfEvent = {
  sessionId: string;
  timestamp: number; // Relative to session start (ms)
  absoluteTime: number; // Date.now()
  platform: 'web' | 'desktop' | 'ext' | 'ios' | 'android';
  type:
    | 'module_load'
    | 'function_call'
    | 'memory'
    | 'fps'
    | 'long_task'
    | 'mark';
  data:
    | IModuleLoadData
    | IFunctionCallData
    | IMemoryData
    | IFpsData
    | ILongTaskData
    | IMarkData;
};

export type IModuleLoadData = {
  path: string;
  duration: number;
};

export type IFunctionCallData = {
  name: string;
  file: string;
  line?: number;
  duration: number;
  module?: string;
  stack?: string[];
};

export type IMemoryData = {
  heapUsed?: number;
  heapTotal?: number;
  external?: number;
  rss?: number;
};

export type IFpsData = {
  fps: number;
  dropped?: number;
};

export type ILongTaskData = {
  duration: number;
  attribution?: string;
};

export type IMarkData = {
  name: string;
  detail?: any;
};

export type IPerfReporterOptions = {
  serverUrl: string;
  timeout: number;
  platform?: 'web' | 'desktop' | 'ext' | 'ios' | 'android';
};

export type IPerfReporterInstance = {
  send: (type: IPerfEvent['type'], data: IPerfEvent['data']) => void;
  isConnected: () => boolean;
  close: () => void;
};
