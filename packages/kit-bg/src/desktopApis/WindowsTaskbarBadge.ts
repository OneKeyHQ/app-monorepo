import { nativeImage, systemPreferences } from 'electron';
import logger from 'electron-log/main';

import type { BrowserWindow } from 'electron';

const BADGE_SIZE = 96;
const BADGE_RADIUS = 44;
const MAX_BADGE_COUNT = 99;
const DEFAULT_ACCENT_COLOR = '#4cc2ff';

function normalizeAccentColor(value: string): string {
  const hex = value.replace(/^#/, '');
  if (/^[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(hex)) {
    return `#${hex.slice(0, 6)}`;
  }
  return DEFAULT_ACCENT_COLOR;
}

function getAccentColor(): string {
  try {
    return normalizeAccentColor(systemPreferences.getAccentColor());
  } catch (error) {
    logger.warn('Failed to read Windows accent color', error);
    return DEFAULT_ACCENT_COLOR;
  }
}

function getTextColor(backgroundColor: string): string {
  const red = Number.parseInt(backgroundColor.slice(1, 3), 16);
  const green = Number.parseInt(backgroundColor.slice(3, 5), 16);
  const blue = Number.parseInt(backgroundColor.slice(5, 7), 16);
  const brightness = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  return brightness > 160 ? '#000000' : '#ffffff';
}

function buildBadgeScript(count: number): string {
  const label = count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : `${count}`;
  const backgroundColor = getAccentColor();
  const textColor = getTextColor(backgroundColor);
  const fontSize = label.length > 2 ? 42 : 62;

  return `(() => {
    const canvas = document.createElement('canvas');
    canvas.width = ${BADGE_SIZE};
    canvas.height = ${BADGE_SIZE};
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.fillStyle = ${JSON.stringify(backgroundColor)};
    context.beginPath();
    context.arc(${BADGE_SIZE / 2}, ${BADGE_SIZE / 2}, ${BADGE_RADIUS}, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ${JSON.stringify(textColor)};
    context.font = ${JSON.stringify(`600 ${fontSize}px "Segoe UI"`)};
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(${JSON.stringify(label)}, ${BADGE_SIZE / 2}, ${BADGE_SIZE / 2});
    return canvas.toDataURL('image/png');
  })()`;
}

class WindowsTaskbarBadge {
  private window: BrowserWindow | undefined;

  private currentCount = 0;

  private latestRequestedCount = 0;

  private currentOverlayIcon: ReturnType<
    typeof nativeImage.createFromDataURL
  > | null = null;

  private updateVersion = 0;

  constructor(window: BrowserWindow) {
    this.window = window;
    window.on('show', this.handleWindowShow);
    window.once('closed', this.handleWindowClosed);
    systemPreferences.on('accent-color-changed', this.handleAccentColorChanged);
  }

  private getDescription(): string {
    return this.currentCount > 0
      ? `Unread notifications: ${this.currentCount}`
      : '';
  }

  private handleWindowShow = () => {
    const window = this.window;
    if (!window || window.isDestroyed()) {
      return;
    }
    window.setOverlayIcon(this.currentOverlayIcon, this.getDescription());
  };

  private handleWindowClosed = () => {
    this.updateVersion += 1;
    const window = this.window;
    window?.removeListener('show', this.handleWindowShow);
    systemPreferences.removeListener(
      'accent-color-changed',
      this.handleAccentColorChanged,
    );
    this.window = undefined;
    this.latestRequestedCount = 0;
    this.currentCount = 0;
    this.currentOverlayIcon = null;
  };

  private handleAccentColorChanged = () => {
    if (this.latestRequestedCount > 0) {
      void this.update(this.latestRequestedCount);
    }
  };

  private isLatestUpdate(window: BrowserWindow, updateVersion: number) {
    return (
      updateVersion === this.updateVersion &&
      this.window === window &&
      !window.isDestroyed()
    );
  }

  private clearOverlay(window: BrowserWindow) {
    this.currentCount = 0;
    this.currentOverlayIcon = null;
    window.setOverlayIcon(null, '');
  }

  async update(badgeNumber: number): Promise<void> {
    const count =
      Number.isFinite(badgeNumber) && badgeNumber > 0
        ? Math.floor(badgeNumber)
        : 0;
    this.updateVersion += 1;
    const updateVersion = this.updateVersion;
    this.latestRequestedCount = count;

    const window = this.window;
    if (!window || window.isDestroyed()) {
      return;
    }

    if (count === 0) {
      this.clearOverlay(window);
      return;
    }

    try {
      const dataUrl = await window.webContents.executeJavaScript(
        buildBadgeScript(count),
      );
      if (!this.isLatestUpdate(window, updateVersion)) {
        return;
      }
      if (
        typeof dataUrl !== 'string' ||
        !dataUrl.startsWith('data:image/png;base64,')
      ) {
        logger.warn(
          'Windows taskbar badge renderer returned invalid image data',
        );
        this.clearOverlay(window);
        return;
      }

      const image = nativeImage.createFromDataURL(dataUrl);
      if (image.isEmpty()) {
        logger.warn('Windows taskbar badge renderer returned an empty image');
        this.clearOverlay(window);
        return;
      }

      this.currentCount = count;
      this.currentOverlayIcon = image;
      window.setOverlayIcon(image, this.getDescription());
    } catch (error) {
      if (!this.isLatestUpdate(window, updateVersion)) {
        return;
      }
      logger.error('Failed to update Windows taskbar badge', error);
      this.clearOverlay(window);
    }
  }
}

export default WindowsTaskbarBadge;
