import {
  CONFIRMATION_VERSION,
  WARNING_CODES,
  createDeletionClient as createClient,
} from './protocol';

const createDeletionClient = (transport: Parameters<typeof createClient>[0]) =>
  createClient(transport, { origin: 'https://prime.example.invalid' });

const proof = {
  invitationToken: 'fixture-opaque-invite',
  provider: 'google' as const,
  supabaseAccessToken: 'fixture-supabase-proof',
};
const attempt = {
  ...proof,
  challengeId: 'fixture-challenge',
  code: '01234567',
  confirmationVersion: CONFIRMATION_VERSION,
  acknowledgements: [...WARNING_CODES],
};
const receipt = {
  status: 'completed',
  resultId: 'fixture-operation',
  supportReference: 'OKD-FIXTURE',
  completedAt: '2030-01-01T00:01:00Z',
  deletedScope: ['onekey_server_share'],
  retainedScope: ['juicebox_share', 'cloud_sync', 'onekey_id'],
};

function returning(data: unknown, init?: ResponseInit) {
  return createDeletionClient(() => Promise.resolve(Response.json(data, init)));
}

it('sends the official deletion payload with the leading zero intact, and limits result requests to proof', async () => {
  const sent: Request[] = [];
  const client = createDeletionClient((request) => {
    sent.push(request);
    return Promise.resolve(
      Response.json({ code: 0, message: 'success', data: receipt }),
    );
  });
  const staleForm = {
    ...attempt,
    confirmed: true,
    acknowledgements: [...WARNING_CODES, WARNING_CODES[0]],
  };
  await expect(client.deleteShare(staleForm, 'fixture-key')).resolves.toEqual(
    receipt,
  );
  await expect(client.getResult(staleForm)).resolves.toEqual(receipt);
  await expect(sent[0]?.json()).resolves.toEqual(attempt);
  expect(sent[0]?.headers.get('Idempotency-Key')).toBe('fixture-key');
  await expect(sent[1]?.json()).resolves.toEqual(proof);
  expect(sent[1]?.headers.has('Idempotency-Key')).toBe(false);
});

it.each([
  [90_900, 'INVITATION_UNAVAILABLE'],
  [90_901, 'AUTH_INVALID'],
  [90_902, 'AUTH_EXPIRED'],
  [90_903, 'IDENTITY_MISMATCH'],
  [90_904, 'OTP_INVALID'],
  [90_905, 'OTP_EXPIRED'],
  [90_906, 'RATE_LIMITED'],
  [90_907, 'CONFIRMATION_REQUIRED'],
  [90_908, 'CONFIRMATION_CHANGED'],
  [90_909, 'TARGET_CHANGED'],
  [90_910, 'DELETION_DISABLED'],
  [90_911, 'IDEMPOTENCY_CONFLICT'],
  [90_912, 'OPERATION_IN_PROGRESS'],
  [90_914, 'SERVICE_UNAVAILABLE'],
  [90_915, 'INVALID_REQUEST'],
  [90_001, 'INVALID_REQUEST'],
])(
  'maps HTTP 200 Prime error %i to %s without a legacy data envelope',
  async (code, semantic) => {
    const error = {
      code,
      message: '服务端本地化提示。',
      messageId: 'error__service_prime_keyless_deletion_fixture',
    };
    await expect(
      returning(error).deleteShare(attempt, 'fixture-key'),
    ).rejects.toMatchObject({
      response: { code: semantic },
      notice: { userMessage: error.message },
    });
  },
);

it('uses the greater of the Prime retryAfterSec and Retry-After values', async () => {
  const client = returning(
    { code: 90_906, message: '稍后重试。', retryAfterSec: 61 },
    { status: 429, headers: { 'Retry-After': '70' } },
  );
  await expect(client.sendDeletionOtp(proof)).rejects.toMatchObject({
    response: { code: 'RATE_LIMITED', retryAfterSeconds: 70 },
  });
});

it('honors a gateway Retry-After even without JSON and uses a conservative fallback for invalid backoff', async () => {
  const client = createDeletionClient(() =>
    Promise.resolve(
      new Response(null, {
        status: 429,
        headers: { 'Retry-After': '15' },
      }),
    ),
  );
  await expect(client.getResult(proof)).rejects.toMatchObject({
    response: { code: 'RATE_LIMITED', retryAfterSeconds: 15 },
  });
  await expect(
    returning({ code: 90_906, message: '', retryAfterSec: -1 }).sendDeletionOtp(
      proof,
    ),
  ).rejects.toMatchObject({
    response: { code: 'RATE_LIMITED', retryAfterSeconds: 60 },
  });
});

it('uses the reference in data for manual review and rejects malformed review data', async () => {
  const manual = { code: 90_913, message: '需要人工核查。' };
  await expect(
    returning({
      ...manual,
      data: { supportReference: 'OKD-FIXTURE' },
    }).deleteShare(attempt, 'fixture-key'),
  ).rejects.toMatchObject({
    response: {
      code: 'MANUAL_REVIEW_REQUIRED',
      supportReference: 'OKD-FIXTURE',
    },
  });
  await expect(
    returning(manual).deleteShare(attempt, 'fixture-key'),
  ).rejects.toBeInstanceOf(SyntaxError);
});

it('does not trust legacy tags, old Jira numbers, or HTTP 5xx with a definitive error', async () => {
  const envelopes = [
    {
      response: { code: -1, message: '', messageId: 'OTP_INVALID' },
      status: 200,
    },
    { response: { code: 90_804, message: '' }, status: 200 },
    { response: { code: 90_904, message: '' }, status: 503 },
  ];
  for (const { response, status } of envelopes) {
    await expect(
      returning(response, { status }).deleteShare(attempt, 'fixture-key'),
    ).rejects.toMatchObject({
      serverCode: response.code,
      httpStatusCode: status,
    });
  }
});
