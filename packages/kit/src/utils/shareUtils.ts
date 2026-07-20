import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Whether a real system share surface exists on this platform. When false,
// share would silently duplicate "save", so callers should hide the entry.
export function canShareImageToSystem(): boolean {
  if (platformEnv.isNative) {
    return true;
  }
  if (platformEnv.isDesktop) {
    // Electron only implements the system share picker (ShareMenu) on macOS
    return !!platformEnv.isDesktopMac;
  }
  try {
    const probe = new File([''], 'probe.png', { type: 'image/png' });
    return !!navigator.share && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

export function downloadBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export async function downloadImageFile(
  base64Image: string,
  filename: string,
): Promise<void> {
  const blob = await fetch(base64Image).then((r) => r.blob());
  downloadBlobAsFile(blob, filename);
}

// Desktop share: Electron has no navigator.share; on macOS the main process
// pops the native share picker (ShareMenu). Other desktop platforms have no
// system share — callers hide the entry via canShareImageToSystem(), and
// downloading the file stays as the last-resort fallback.
export async function shareImageOnDesktop(
  base64Image: string,
  filename: string,
): Promise<void> {
  let shared = false;
  try {
    shared = await globalThis.desktopApiProxy.system.shareImageFile({
      base64Image,
    });
  } catch {
    // the installed main process may predate this API (the JS bundle updates
    // independently of the binary) or reject the payload — degrade to download
  }
  if (!shared) {
    await downloadImageFile(base64Image, filename);
  }
}
