// Shared contract for PostHog Session Replay.
// Everything here runs in the UI runtime only: `main` on iOS/Android, the
// renderer on desktop. The `bg` runtime must never import replay modules.

export type IReplayPlatform = 'ios' | 'android' | 'desktop';

export type IReplayPauseReason =
  | 'noController'
  | 'notSampled'
  | 'outOfScope'
  | 'sensitive'
  | 'locked'
  | 'travelMode'
  | 'splitView'
  | 'background';

export type IReplayGateCondition =
  | 'locked'
  | 'travelMode'
  | 'splitView'
  | 'background';

export interface IReplayController {
  readonly platform: IReplayPlatform;
  // Current replay session id (lowercase UUIDv7) without side effects.
  getSessionId(): string | undefined;
  // Called on user activity (navigation, foreground). May rotate the session
  // (30 min idle / 24 h max). If it rotates while recording, the controller
  // stops recording before switching ids. Resolves to the current id.
  touchSession(): Promise<string | undefined>;
  // Must not bypass the gate: the gate is the only caller of start/stop.
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface IReplayControllerRegistration {
  controller: IReplayController;
  // Sampling threshold in buckets out of 10000 (300 = 3%).
  threshold: number;
  // QA override: treat every session as sampled. Only honored when the build
  // talks to the test endpoint.
  forced: boolean;
}

export interface IReplayGateStatus {
  hasController: boolean;
  platform?: IReplayPlatform;
  sessionId?: string;
  bucket?: number;
  sampled: boolean;
  forced: boolean;
  recording: boolean;
  // Kept after recording stops, so QA can confirm capture ran even when the
  // status is read from a screen that pauses replay (e.g. Settings).
  lastRecordingSessionId?: string;
  lastRecordingStartedAt?: number;
  routeKey?: string;
  pauseReasons: IReplayPauseReason[];
}

export interface IInitSessionReplayOptions {
  instanceId: string;
  enableTestEndpoint: boolean;
  forceRecord: boolean;
}

export interface IReplayProjectConfig {
  // Public PostHog project token; undefined disables replay.
  token: string | undefined;
  // Ingestion host. v1 talks to PostHog EU directly; switch to the OneKey
  // utility proxy (/utility/v1/track/rp) once it is deployed.
  host: string;
}
