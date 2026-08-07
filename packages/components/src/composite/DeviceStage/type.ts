import type { IHardwareDeviceType } from '../../content/HardwareDevice';

/**
 * Exploration-only hardware-interaction stage. Deliberately minimal, like the
 * DialogV2 it wraps: enough surface to judge the look and the step-to-step
 * feel, nothing else. Event wiring, honest cancel semantics and i18n belong
 * to the integration layer built after this is accepted.
 */

/**
 * Where the interaction currently stands. One dialog instance plays every
 * step of a burst; the content swaps in place so consecutive device requests
 * never close and reopen the surface.
 */
export type IDeviceStageStep =
  | 'connecting'
  | 'enterPin'
  | 'enterPassphrase'
  | 'confirm';

export interface IDeviceStageProps {
  /** Controlled visibility, passed straight through to the dialog. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Model on stage. Models without a replica render an empty stage. */
  deviceType: IHardwareDeviceType;
  step: IDeviceStageStep;
  /**
   * One line of operation context under the confirm title — what the person
   * is about to approve, e.g. "Send 0.1 ETH". The current toast shows
   * nothing, which is the gap this line exists to close.
   */
  confirmContext?: string;
  /**
   * Blocks every dismissal path for steps that must not be interrupted
   * (a firmware install, not an everyday confirm).
   */
  locked?: boolean;
}
