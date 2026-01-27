/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) AlexTorresDev. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import { Menu } from 'electron'
import { Color } from 'base/common/color'

export interface MenuBarOptions {
    /**
     * Enable the mnemonics on menubar and menu items
     * **The default is true**
     */
    enableMnemonics?: boolean;
    /**
     * The path of the icons of menubar.
     */
    icons?: string;
    /**
     * The background color when the mouse is over the item.
     * **The default is undefined**
     */
    itemBackgroundColor?: Color;
    /**
     * The background color of the menu.
     * **The default is automatic**
     */
    menuBarBackgroundColor?: Color;
    /**
     * The position of menubar on titlebar.
     * **The default is left**
     */
    menuPosition?: 'left' | 'bottom';
    /**
     * The color of the menu separator.
     * **The default is automatic**
     */
    menuSeparatorColor?: Color;
    /**
     * The menu container transparency
     * **The default is 0 (not apply transparency)*
     */
    menuTransparency?: number;
    /**
     * Define if is only rendering the menubar without the titlebar.
     * **The default is false**
     */
    onlyShowMenuBar?: boolean;
    /**
     * The color of the svg icons in the menu
     * **The default is automatic**
     */
    svgColor?: Color;
}