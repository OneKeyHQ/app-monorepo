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
 * never close and reopen the surface. `off` is the step before the device
 * responds: no scene, the replica sits with its screen dark, and whichever
 * step follows enters by waking it.
 */
export type IDeviceStageStep =
  | 'off'
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
   * Rows of the payload being approved — label over value, one card. It
   * fades in once the compact confirm arrangement lands: the on-screen
   * copy of what must be verified against the device. `highlightEnds`
   * gives a value the receive page's address grammar (mono, grouped by
   * four, first and last six characters highlighted).
   */
  confirmDetails?: Array<{
    label: string;
    value: string;
    highlightEnds?: boolean;
  }>;
  /**
   * Blocks every dismissal path for steps that must not be interrupted
   * (a firmware install, not an everyday confirm).
   */
  locked?: boolean;
  /**
   * Passed to the dialog: keep the app behind the sheet interactive on
   * native, for drivers that steer the stage from the host screen.
   */
  backgroundInteractive?: boolean;
}
