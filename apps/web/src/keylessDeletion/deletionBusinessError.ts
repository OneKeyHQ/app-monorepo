export type IBusinessNotice = {
  userMessage?: string;
  disableAutoToast: boolean;
};

export class DeletionBusinessError extends Error {
  constructor(
    public readonly serverCode: number,
    public readonly httpStatusCode: number,
    public readonly notice: IBusinessNotice,
  ) {
    super('Keyless deletion business error.');
  }
}
