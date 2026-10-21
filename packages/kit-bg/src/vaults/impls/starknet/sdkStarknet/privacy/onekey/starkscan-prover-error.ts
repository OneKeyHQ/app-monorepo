// onekey: non-prover failures from the Starkscan REST prover transport.
// `code` is Starkscan's body `code` when present, otherwise `http_<status>` or
// one of the codes synthesized in starkscan-proving-service.ts.
export class StarkscanProverError extends Error {
  override readonly name = 'StarkscanProverError';

  readonly code: string;

  readonly status?: number;

  readonly jobId?: string;

  readonly retryAfterSeconds?: number;

  constructor(
    code: string,
    message: string,
    details: {
      status?: number;
      jobId?: string;
      retryAfterSeconds?: number;
    } = {},
  ) {
    super(message);
    this.code = code;
    this.status = details.status;
    this.jobId = details.jobId;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}
