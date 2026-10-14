export function invoke(
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown>;

export function isAvailable(): boolean;
