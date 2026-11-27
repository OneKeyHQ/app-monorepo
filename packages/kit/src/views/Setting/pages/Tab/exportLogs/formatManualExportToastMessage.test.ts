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
});
