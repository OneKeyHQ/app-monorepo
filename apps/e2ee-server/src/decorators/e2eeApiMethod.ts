/**
 * Decorator to mark methods as allowed E2EE API methods
 * Only methods decorated with @e2eeApiMethod can be called via the remote API
 */

// Symbol to store allowed methods metadata
export const E2EE_API_METHODS_KEY = Symbol('e2eeApiMethods');

/**
 * Decorator function to mark a method as an allowed E2EE API method
 */
export function e2eeApiMethod() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    // Get existing allowed methods or initialize empty set
    const allowedMethods =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      target.constructor[E2EE_API_METHODS_KEY] || new Set<string>();

    // Add this method to the allowed methods set
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    allowedMethods.add(propertyKey);

    // Store the updated set back on the constructor
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    target.constructor[E2EE_API_METHODS_KEY] = allowedMethods;

    return descriptor;
  };
}

/**
 * Check if a method is allowed to be called via E2EE API
 */
export function isMethodAllowed(instance: any, methodName: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const constructor = instance.constructor;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const allowedMethods = constructor[E2EE_API_METHODS_KEY] as Set<string>;

  return allowedMethods?.has(methodName) || false;
}
