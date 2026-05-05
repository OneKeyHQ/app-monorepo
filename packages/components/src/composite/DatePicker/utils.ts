export function callOnClick<T extends { onClick?: (...args: any[]) => void }>(
  obj: T,
): void {
  obj.onClick?.();
}
