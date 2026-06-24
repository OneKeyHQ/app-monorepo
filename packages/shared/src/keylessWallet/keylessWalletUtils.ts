import bufferUtils from '../utils/bufferUtils';

/**
 * Extract the x-coordinate from a share.
 * Share format (shamir-secret-sharing library): [y-values (N bytes), x-coordinate (1 byte)]
 */
function getShareXCoordinate(shareBase64: string): number {
  const shareBytes = bufferUtils.base64ToBytes(shareBase64);
  return shareBytes[shareBytes.length - 1];
}

export default {
  getShareXCoordinate,
};
