import { formatManualExportToastMessage } from './logUploadUtils';

describe('formatManualExportToastMessage', () => {
  it('maps desktop permission errors without leaking local paths or braces', () => {
    const err = Object.assign(
      new Error(
        "EACCES: permission denied, open '/Users/alice/{work}/OneKey/logs/app.log'",
      ),
      { code: 'EACCES' },
    );

    expect(formatManualExportToastMessage(err)).toBe(
      'Permission denied while exporting logs.',
    );
  });

  it('maps disk-space, missing-path, and read-only filesystem errors', () => {
    expect(
      formatManualExportToastMessage(
        new Error(
          "ENOSPC: no space left on device, write '/Users/alice/a.zip'",
        ),
      ),
    ).toBe('Not enough disk space to export logs.');

    expect(
      formatManualExportToastMessage(
        new Error(
          "ENOENT: no such file or directory, scandir '/Users/alice/logs'",
        ),
      ),
    ).toBe('Log directory or file was not found.');

    expect(
      formatManualExportToastMessage(
        new Error("EROFS: read-only file system, open '/var/logs/a.zip'"),
      ),
    ).toBe('Export destination is read-only.');
  });

  it('preserves non-filesystem errors such as browser reset errors', () => {
    expect(
      formatManualExportToastMessage(
        new Error('Log export unavailable during app reset'),
      ),
    ).toBe('Log export unavailable during app reset');
  });

  it('redacts absolute paths and neutralizes ICU braces in unknown errors', () => {
    const result = formatManualExportToastMessage(
      new Error("Failed to archive '/Users/alice/{team}/logs/latest.log'"),
    );

    expect(result).toBe('Failed to archive <path>');
    expect(result).not.toContain('alice');
    expect(result).not.toContain('{');
    expect(result).not.toContain('}');
  });

  it('classifies by actual errno even when the path contains another errno substring', () => {
    const withCode = Object.assign(
      new Error(
        "ENOSPC: no space left on device, open '/home/steperman/logs_zip/a.zip'",
      ),
      { code: 'ENOSPC' },
    );
    expect(formatManualExportToastMessage(withCode)).toBe(
      'Not enough disk space to export logs.',
    );

    const ipcSerialized = new Error(
      "Error invoking remote method 'desktop:exportLogs': ENOSPC: no space left on device, open '/home/steperman/logs_zip/a.zip'",
    );
    expect(formatManualExportToastMessage(ipcSerialized)).toBe(
      'Not enough disk space to export logs.',
    );
  });

  it('redacts quoted Windows and macOS paths containing spaces completely', () => {
    const winResult = formatManualExportToastMessage(
      new Error(
        "Failed to archive 'C:\\Users\\Alice Example\\AppData\\Roaming\\OneKey\\logs'",
      ),
    );
    expect(winResult).toBe('Failed to archive <path>');
    expect(winResult).not.toContain('Alice');
    expect(winResult).not.toContain('Example');
    expect(winResult).not.toContain('AppData');

    const macResult = formatManualExportToastMessage(
      new Error(
        'Failed to read "/Users/Alice Example/Library/Application Support/OneKey/logs"',
      ),
    );
    expect(macResult).toBe('Failed to read <path>');
    expect(macResult).not.toContain('Alice');
    expect(macResult).not.toContain('Application Support');
  });

  it.each([
    [
      'a Windows path containing an apostrophe',
      "C:\\Users\\Alice O'Connor\\AppData\\Roaming\\OneKey\\logs\\app.log",
    ],
    [
      'a Linux path under a custom root',
      '/srv/profiles/Alice Example/.config/OneKey/logs/app.log',
    ],
  ])('redacts %s from ADM-ZIP errors', (_description, path) => {
    const error = new Error(`ADM-ZIP: File not found: "${path}"`);

    expect(formatManualExportToastMessage(error)).toBe(
      'ADM-ZIP: File not found: <path>',
    );
  });
});
