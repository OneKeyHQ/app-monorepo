import {
  CONFIRMATION_VERSION,
  DELETION_SCOPE,
  RETAINED_SCOPE,
  WARNING_CODES,
  createDeletionClient,
} from './protocol';

import type { IDeleteRequest, IDeletionClient, IProof } from './protocol';

const proof: IProof = {
  invitationToken: 'fixture-opaque-invite',
  provider: 'google',
  supabaseAccessToken: 'fixture:google:account-a',
};
const request: IDeleteRequest = {
  ...proof,
  challengeId: 'fixture-challenge',
  code: '246810',
  confirmationVersion: CONFIRMATION_VERSION,
  acknowledgements: [...WARNING_CODES],
};
const serverTime = '2030-01-01T00:00:00Z';
const expiresAt = '2030-01-01T00:05:00Z';
const link = {
  status: 'ready',
  allowedProvider: 'google',
  serverTime,
  expiresAt,
  confirmationVersion: CONFIRMATION_VERSION,
  deletionScope: [DELETION_SCOPE],
  retainedScope: RETAINED_SCOPE,
  warningCodes: WARNING_CODES,
  recreationPolicy: 'allowed_new_wallet',
};
const challenge = {
  challengeId: request.challengeId,
  maskedEmail: 't•••@example.invalid',
  serverTime,
  expiresAt,
  resendAfterSeconds: 10,
};
const result = {
  status: 'completed',
  resultId: 'fixture-result',
  completedAt: serverTime,
  deletedScope: [DELETION_SCOPE],
  retainedScope: RETAINED_SCOPE,
  supportReference: 'FIXTURE-ref',
};

type IEndpoint = {
  route: string;
  call: (client: IDeletionClient) => Promise<unknown>;
  success: Record<string, unknown>;
  invalid: Record<string, unknown>[];
};

const endpoints: IEndpoint[] = [
  {
    route: '/link-info',
    call: (client) => client.getLinkInfo(proof.invitationToken),
    success: link,
    invalid: [
      { ...link, status: 'deleted' },
      { ...link, provider: 'google', allowedProvider: undefined },
      { ...link, retainedScope: ['cloud_sync'] },
      { ...link, deletionScope: ['juicebox_share'] },
      { ...link, expiresAt: serverTime },
    ],
  },
  {
    route: '/otp/send',
    call: (client) => client.sendDeletionOtp(proof),
    success: challenge,
    invalid: [
      { ...challenge, status: 'queued' },
      { ...challenge, challengeId: undefined },
      { ...challenge, resendAfterSeconds: -1 },
      { ...challenge, resendAfterSeconds: '10' },
      { ...challenge, expiresAt: serverTime },
    ],
  },
  {
    route: '/delete',
    call: (client) => client.deleteShare(request, 'fixture-key'),
    success: result,
    invalid: [
      { ...result, status: 'processing' },
      { ...result, supportReference: undefined },
      { ...result, completedAt: 1000 },
      { ...result, deletedScope: ['juicebox_share'] },
      { ...result, retainedScope: ['cloud_sync'] },
    ],
  },
  {
    route: '/result',
    call: (client) => client.getResult(proof),
    success: result,
    invalid: [
      { ...result, status: 'unknown' },
      { ...result, resultId: undefined },
      { ...result, deletedScope: ['juicebox_share'] },
      {
        status: 'processing',
        resultId: 'fixture-result',
        supportReference: 'FIXTURE-ref',
        retryAfterSeconds: -1,
      },
    ],
  },
];

const origin = 'https://prime.example.invalid';
const primeSuccess = (data: unknown) => ({ code: 0, message: 'success', data });

function clientReturning(response: Response) {
  return createDeletionClient(() => Promise.resolve(response), { origin });
}

describe.each(endpoints)(
  'v0.2 transport faults at $route',
  ({ call, success, invalid }) => {
    it('accepts the corresponding valid success payload', async () => {
      await expect(
        call(clientReturning(Response.json(primeSuccess(success)))),
      ).resolves.toEqual(success);
    });

    it('rejects a transport disconnect and bounds a request or body that never settles', async () => {
      const disconnected = new TypeError('Fixture network disconnected.');
      await expect(
        call(
          createDeletionClient(() => Promise.reject(disconnected), { origin }),
        ),
      ).rejects.toBe(disconnected);
      const pending = createDeletionClient(
        () => new Promise<Response>(() => {}),
        { origin, timeoutMs: 20 },
      );
      await expect(call(pending)).rejects.toMatchObject({
        name: 'TimeoutError',
      });
      const body = new Response(new ReadableStream(), {
        headers: { 'content-type': 'application/json' },
      });
      const waitingForBody = createDeletionClient(() => Promise.resolve(body), {
        origin,
        timeoutMs: 20,
      });
      await expect(call(waitingForBody)).rejects.toMatchObject({
        name: 'TimeoutError',
      });
    });

    it('rejects non-JSON, corrupt JSON, unknown envelopes and a valid payload at the wrong HTTP status', async () => {
      const responses = [
        new Response(JSON.stringify(success), {
          headers: { 'content-type': 'text/html' },
        }),
        new Response('{', { headers: { 'content-type': 'application/json' } }),
        Response.json({ data: success }),
        Response.json(success),
        Response.json(primeSuccess(success), { status: 201 }),
        Response.json(primeSuccess(success), { status: 400 }),
        Response.json({ ...primeSuccess(success), code: '0' }),
        Response.json({ ...primeSuccess(success), message: undefined }),
        Response.json({ ...primeSuccess(success), messageId: 'OTP_INVALID' }),
      ];
      for (const response of responses) {
        await expect(call(clientReturning(response))).rejects.toThrow();
      }
    });

    it('rejects missing fields and unsupported route-specific states, ranges or timing', async () => {
      for (const payload of invalid) {
        await expect(
          call(clientReturning(Response.json(primeSuccess(payload)))),
        ).rejects.toThrow();
      }
    });

    it('honors valid Prime rate limits and ignores malformed retry hints', async () => {
      const limited = { code: 90_906, message: 'Too many attempts.' };
      for (const retryAfterSec of [5, -1, '5', null]) {
        const response = Response.json(
          { ...limited, retryAfterSec },
          { status: 429 },
        );
        await expect(call(clientReturning(response))).rejects.toMatchObject({
          response: {
            code: 'RATE_LIMITED',
            retryAfterSeconds: retryAfterSec === 5 ? 5 : 60,
          },
        });
      }
    });
  },
);

it.each([200, 422, 503])(
  'preserves a generic Prime failure and safe translated text at HTTP %i',
  async (status) => {
    const error = {
      code: -1,
      messageId: 'UNMAPPED_BUSINESS_ERROR',
      message: '请稍后重试。',
      translatedMessage: '暂时无法处理，请稍后重试。',
      data: null,
    };
    await expect(
      clientReturning(Response.json(error, { status })).getLinkInfo(
        'fixture-opaque-invite',
      ),
    ).rejects.toMatchObject({
      serverCode: -1,
      httpStatusCode: status,
      notice: { userMessage: error.translatedMessage },
    });
  },
);

it('maps a numeric Prime HTTP 200 failure and honors disableAutoToast', async () => {
  await expect(
    clientReturning(
      Response.json({
        code: 90_903,
        message: '请使用邀请关联的账号。',
        disableAutoToast: true,
      }),
    ).sendDeletionOtp(proof),
  ).rejects.toMatchObject({
    response: { code: 'IDENTITY_MISMATCH' },
    notice: { disableAutoToast: true, userMessage: '请使用邀请关联的账号。' },
  });
});

it.each([
  '<b>原文</b>',
  'TypeError: unexpected stack detail',
  '后台错误：请核对 fixture:google:account-a。',
  '验证码：246810',
])(
  'ignores unsafe server prose and tries the public message',
  async (translatedMessage) => {
    const client = (message: string) =>
      clientReturning(
        Response.json({ code: -1, translatedMessage, message, data: null }),
      );
    await expect(
      client('请稍后再试。').deleteShare(request, 'fixture-key'),
    ).rejects.toMatchObject({
      notice: { userMessage: '请稍后再试。' },
    });
    await expect(
      client('请求失败：fixture-key').deleteShare(request, 'fixture-key'),
    ).rejects.toMatchObject({
      notice: { userMessage: undefined },
    });
  },
);
