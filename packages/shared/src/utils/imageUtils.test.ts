import {
  getImageSize,
  isImageFile,
  getImageMimeType,
} from './imageUtils';

describe('imageUtils', () => {
  describe('isImageFile', () => {
    it('should return true for png file', () => {
      const result = isImageFile('image.png');
      expect(result).toBe(true);
    });

    it('should return true for jpg file', () => {
      const result = isImageFile('photo.jpg');
      expect(result).toBe(true);
    });

    it('should return true for jpeg file', () => {
      const result = isImageFile('image.jpeg');
      expect(result).toBe(true);
    });

    it('should return true for gif file', () => {
      const result = isImageFile('animation.gif');
      expect(result).toBe(true);
    });

    it('should return true for webp file', () => {
      const result = isImageFile('image.webp');
      expect(result).toBe(true);
    });

    it('should return false for non-image file', () => {
      const result = isImageFile('document.pdf');
      expect(result).toBe(false);
    });

    it('should return false for file without extension', () => {
      const result = isImageFile('filename');
      expect(result).toBe(false);
    });
  });

  describe('getImageMimeType', () => {
    it('should return image/png for png', () => {
      const result = getImageMimeType('png');
      expect(result).toBe('image/png');
    });

    it('should return image/jpeg for jpg', () => {
      const result = getImageMimeType('jpg');
      expect(result).toBe('image/jpeg');
    });

    it('should return image/jpeg for jpeg', () => {
      const result = getImageMimeType('jpeg');
      expect(result).toBe('image/jpeg');
    });

    it('should return image/gif for gif', () => {
      const result = getImageMimeType('gif');
      expect(result).toBe('image/gif');
    });

    it('should return image/webp for webp', () => {
      const result = getImageMimeType('webp');
      expect(result).toBe('image/webp');
    });

    it('should return empty string for unknown type', () => {
      const result = getImageMimeType('unknown');
      expect(result).toBe('');
    });
  });
});
