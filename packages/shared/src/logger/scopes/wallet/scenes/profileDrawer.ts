import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export type IProfileDrawerItem =
  | 'account'
  | 'oneKeyId'
  | 'signIn'
  | 'scan'
  | 'lock'
  | 'notifications'
  | 'devices'
  | 'prime'
  | 'referral'
  | 'redeem'
  | 'settings'
  | 'support';

// The phone profile drawer opened from the home avatar. The generic click
// event is dropped at ingestion, so the drawer reports on its own.
export class ProfileDrawerScene extends BaseScene {
  /**
   * The drawer opened, with what the avatar dot and the rows showed then.
   */
  @LogToServer()
  public profileDrawerOpened(params: {
    avatarReasons: Array<'notifications' | 'support' | 'firmware'>;
    unreadNotifications: boolean;
    unreadSupport: boolean;
    appUpdate: 'available' | 'updating' | 'failed' | 'none';
    firmwareUpdate: boolean;
  }) {
    return params;
  }

  /**
   * An entry in the drawer was tapped; hadMark says whether it carried a
   * status mark (a count, a dot or an update label) at the time.
   */
  @LogToServer()
  public profileDrawerItemClicked(params: {
    item: IProfileDrawerItem;
    hadMark: boolean;
  }) {
    return params;
  }
}
