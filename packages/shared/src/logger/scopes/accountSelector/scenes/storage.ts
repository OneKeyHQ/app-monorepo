import { cloneDeep } from 'lodash';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../base/decorators';

export class AccountSelectorStorageScene extends BaseScene {
  @LogToConsole()
  public updateSelectedAccount({
    sceneName,
    num,
    sceneUrl,
    oldSelectedAccount,
    newSelectedAccount,
  }: {
    sceneName: EAccountSelectorSceneName | undefined;
    num: number;
    sceneUrl: string | undefined;
    oldSelectedAccount: IAccountSelectorSelectedAccount;
    newSelectedAccount: IAccountSelectorSelectedAccount;
  }) {
    return cloneDeep([
      sceneName,
      num,
      sceneUrl,
      { oldSelectedAccount, newSelectedAccount },
    ]);
  }
}
