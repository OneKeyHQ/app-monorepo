/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) AlexTorresDev. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import type { MenuItem } from 'electron';
import type { IMenuStyle } from './item';
import { CETMenuItem } from './item';
import type { IMenuOptions } from './index';
import { $, append } from '../../base/common/dom';
import type { MenuBarOptions } from '../menubar-options';
import type { IMenuIcons } from '..';

export class CETSeparator extends CETMenuItem {
  private separatorElement?: HTMLElement;

  

  override render(container: HTMLElement) {
    if (container) {
      this.separatorElement = append(
        container,
        $('a.cet-action-label.separator', { role: 'presentation' }),
      );
    }
  }

  override updateStyle(style: IMenuStyle) {
    if (this.separatorElement && style.separatorColor) {
      this.separatorElement.style.borderBottomColor =
        style.separatorColor.toString();
    }
  }
}
