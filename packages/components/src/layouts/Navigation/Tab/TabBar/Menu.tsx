import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

import { useThemeName } from '@onekeyhq/components/src/hooks';
import { Icon } from '@onekeyhq/components/src/primitives';
import type {
  IMenu,
  IMenuItem,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiSystem';

function MenuItemComponent({
  item,
  onClose,
}: {
  item: IMenuItem;
  onClose: () => void;
}) {
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);

  // Fetch icon if item has one
  useEffect(() => {
    if (item.icon && item.commandId) {
      void globalThis.desktopApiProxy?.system
        ?.getMenuItemIcon?.(item.commandId)
        ?.then((dataUrl: string | null) => {
          if (dataUrl) {
            setIconDataUrl(dataUrl);
          }
        });
    }
  }, [item.icon, item.commandId]);

  const handleClick = useCallback(() => {
    if (!item.enabled || item.submenu) {
      return;
    }
    // Execute menu command via IPC
    void globalThis.desktopApiProxy?.system
      ?.executeMenuCommand?.(item.commandId)
      ?.then(() => {
        onClose();
      });
  }, [item.commandId, item.enabled, item.submenu, onClose]);

  if (item.type === 'separator') {
    return <div className="desktop-menu-separator" />;
  }

  if (!item.visible) {
    return null;
  }

  const hasSubmenu = item.submenu && item.submenu.items.length > 0;

  return (
    <div
      role="menuitem"
      tabIndex={0}
      className={`desktop-menu-item ${!item.enabled ? 'disabled' : ''}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* eslint-disable no-nested-ternary */}
      {iconDataUrl ? (
        <img
          src={iconDataUrl}
          alt=""
          className="desktop-menu-item-icon"
          style={{
            width: 16,
            height: 16,
            marginRight: 8,
            flexShrink: 0,
          }}
        />
      ) : item.icon ? (
        <span
          className="desktop-menu-item-icon-placeholder"
          style={{
            width: 16,
            height: 16,
            marginRight: 8,
            flexShrink: 0,
          }}
        />
      ) : null}
      {/* eslint-enable no-nested-ternary */}
      <span className="desktop-menu-item-label">{item.label}</span>
      {item.accelerator ? (
        <span className="desktop-menu-item-accelerator">
          {item.accelerator
            .replace('CmdOrCtrl', '⌘')
            .replace('Shift', '⇧')
            .replace('Alt', '⌥')
            .replace('+', '')}
        </span>
      ) : null}
      {hasSubmenu ? (
        <>
          <span className="desktop-menu-item-arrow">▶</span>
          <div className="desktop-menu-submenu">
            {item.submenu?.items.map((subItem, index) => (
              <MenuItemComponent
                key={`${subItem.commandId}-${index}`}
                item={subItem}
                onClose={onClose}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuDropdown({
  items,
  isOpen,
  onClose,
}: {
  items: IMenuItem[];
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <div
      role="menu"
      className={`desktop-menu-dropdown ${isOpen ? 'open' : ''}`}
    >
      {items.map((item, index) => (
        <MenuItemComponent
          key={`${item.commandId}-${index}`}
          item={item}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

export function Menu() {
  const [menu, setMenu] = useState<IMenu | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const themeName = useThemeName();

  useEffect(() => {
    void globalThis.desktopApiProxy?.system
      ?.getApplicationMenu?.()
      .then((menuData: IMenu) => {
        setMenu(menuData);
      });
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setActiveMenuIndex(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setActiveMenuIndex(null);
  }, []);

  const handleMenuTriggerClick = useCallback(
    (index: number) => {
      if (isOpen && activeMenuIndex === index) {
        setIsOpen(false);
        setActiveMenuIndex(null);
      } else {
        setIsOpen(true);
        setActiveMenuIndex(index);
      }
    },
    [isOpen, activeMenuIndex],
  );

  const handleMenuTriggerHover = useCallback(
    (index: number) => {
      if (isOpen) {
        setActiveMenuIndex(index);
      }
    },
    [isOpen],
  );

  if (!menu || !menu.items || menu.items.length === 0) {
    return null;
  }

  return (
    <div
      role="menubar"
      ref={containerRef}
      className={`desktop-menu-container ${
        themeName === 'light' ? 'light-theme' : ''
      }`}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '2px',
        padding: '4px 8px',
      }}
    >
      {menu.items.map((menuItem, index) => {
        if (!menuItem.submenu || menuItem.submenu.items.length === 0) {
          return null;
        }

        return (
          <div
            key={`menu-${index}`}
            className="desktop-menu-container"
            style={{ position: 'relative' }}
          >
            <div
              role="menuitem"
              tabIndex={0}
              className="desktop-menu-trigger"
              onClick={() => handleMenuTriggerClick(index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleMenuTriggerClick(index);
                }
              }}
              onMouseEnter={() => handleMenuTriggerHover(index)}
              style={{
                padding: '4px 8px',
                width: 'auto',
                fontSize: '13px',
                color: themeName === 'light' ? '#1a1a1a' : '#e5e5e5',
              }}
            >
              {menuItem.label}
            </div>
            <MenuDropdown
              items={menuItem.submenu.items}
              isOpen={isOpen ? activeMenuIndex === index : false}
              onClose={handleClose}
            />
          </div>
        );
      })}
    </div>
  );
}

export function MenuHamburger() {
  const [menu, setMenu] = useState<IMenu | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const themeName = useThemeName();

  useEffect(() => {
    void globalThis.desktopApiProxy?.system
      ?.getApplicationMenu?.()
      .then((menuData: IMenu) => {
        setMenu(menuData);
      });
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        (!triggerRef.current || !triggerRef.current.contains(target)) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const allItems = useMemo(() => {
    // Flatten all menu items for hamburger menu display
    const itemArray: IMenuItem[] = [];
    menu?.items.forEach((menuItem) => {
      if (menuItem.submenu && menuItem.submenu.items.length > 0) {
        // Add a label item for the menu category
        itemArray.push({
          ...menuItem,
          type: 'submenu',
        });
      }
    });
    return itemArray;
  }, [menu]);

  // Compute dropdown position from trigger element
  const dropdownPosition = useMemo(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      return { top: rect.top, left: rect.right };
    }
    return { top: 0, left: 0 };
  }, [isOpen]);

  if (
    allItems.length === 0 ||
    !menu ||
    !menu.items ||
    menu.items.length === 0
  ) {
    return null;
  }

  return (
    <>
      <div
        ref={triggerRef}
        className={`desktop-menu-container ${
          themeName === 'light' ? 'light-theme' : ''
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Menu"
          className="desktop-menu-trigger"
          onClick={toggleMenu}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleMenu();
            }
          }}
        >
          <Icon
            name="MenuOutline"
            size="$5"
            color={themeName === 'light' ? '$iconSubdued' : '$icon'}
          />
        </div>
      </div>
      {isOpen
        ? createPortal(
            <div
              role="menu"
              ref={dropdownRef}
              className={`desktop-menu-dropdown open ${
                themeName === 'light' ? 'light-theme' : ''
              }`}
              style={{
                position: 'fixed',
                top: dropdownPosition.top,
                left: dropdownPosition.left,
              }}
            >
              {allItems.map((item, index) => (
                <MenuItemComponent
                  key={`${item.commandId}-${index}`}
                  item={item}
                  onClose={handleClose}
                />
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
