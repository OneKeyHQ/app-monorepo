/** @hidden @module */
// eslint-disable-next-line max-classes-per-file
export abstract class Enum {
  enum!: string;

  constructor(properties: any) {
    if (Object.keys(properties).length !== 1) {
      throw new Error('Enum can only take single value');
    }
    // eslint-disable-next-line array-callback-return
    Object.keys(properties).map((key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (this as any)[key] = properties[key];
      this.enum = key;
    });
  }
}

export abstract class Assignable {
  constructor(properties: any) {
    // eslint-disable-next-line array-callback-return
    Object.keys(properties).map((key: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (this as any)[key] = properties[key];
    });
  }
}
