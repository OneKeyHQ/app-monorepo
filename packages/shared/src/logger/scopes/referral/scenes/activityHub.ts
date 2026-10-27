import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

// The product whose gift (or Swap settings item) opened the hub.
export type IActivityHubLogSource = 'Earn' | 'Perps' | 'Swap';

// invite_panel: pointer layouts, with the code and link to copy.
// shortcut: native sheets, with the Referral tile.
// menu: the Perps menu's campaign section.
export type IActivityHubLayout = 'invite_panel' | 'shortcut' | 'menu';

export type IActivityHubAction =
  // Native gift or Swap settings item that skips the hub, or the Referral tile.
  | 'open_referral'
  | 'open_perks'
  // The Perps menu's Referral row on pointer layouts; opens the invite panel
  // in a dialog.
  | 'open_invite_panel'
  // Signed out; opens the referral intro.
  | 'join'
  | 'copy_code'
  | 'copy_link'
  | 'open_campaign';

export class ActivityHubScene extends BaseScene {
  // Once per hub opening, after its content mounts.
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public activityHubShown(params: {
    source: IActivityHubLogSource;
    layout: IActivityHubLayout;
    campaignCount: number;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public activityHubActionPressed(params: {
    source: IActivityHubLogSource;
    action: IActivityHubAction;
    campaignId?: string;
  }) {
    return params;
  }
}
