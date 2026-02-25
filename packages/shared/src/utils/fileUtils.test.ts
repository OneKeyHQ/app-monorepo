import {
  getFileExtension,
  getFileName,
  formatFileSize,
  isValidFileType,
} from './fileUtils';

describe('fileUtils', () => {
  describe('getFileExtension', () => {
    it('should get file extension', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('image.png')).toBe('png');
    });

    it('should return empty for no extension', () => {
      expect(getFileExtension('filename')).toBe('');
    });
  });

  describe('getFileName', () => {
    it('should get file name without extension', () => {
      expect(getFileName('document.pdf')).toBe('document');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    });
  });

  describe('isValidFileType', () => {
    it('should validate file type', () => {
      expect(isValidFileType('image.png', ['png', 'jpg'])).toBe(true);
      expect(isValidFileType('document.pdf', ['png', 'jpg'])).toBe(false);
    });
  });
});
