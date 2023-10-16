// Bool 2 Text
export const b2t = (bool: boolean) => (bool ? 'Yes' : 'No');

const units = ['B', 'KB', 'MB', 'GB', 'TB'];

export const toHumanReadable = (bytes: number): string => {
  let size = Math.abs(bytes);
  let i = 0;

  while (size >= 1024 || i >= units.length) {
    size /= 1024;
    i += 1;
  }

  return `${size.toFixed(1)} ${units[i]}`;
};
