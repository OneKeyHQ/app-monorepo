import axios from 'axios';

import { createServiceMock } from '../service-mock';

describe('service-mock', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('presets 200 responses', async () => {
    const service = createServiceMock();
    service.mockGet(200, { keyBase64: 'k' });

    await expect(axios.get('/v1/key')).resolves.toMatchObject({
      status: 200,
      data: { keyBase64: 'k' },
    });
  });

  it.each([401, 403, 404] as const)(
    'presets %s error responses',
    async (status) => {
      const service = createServiceMock();
      service.mockPost(status, { message: 'denied' });

      await expect(axios.post('/v1/key')).rejects.toMatchObject({
        response: {
          status,
          data: { message: 'denied' },
        },
      });
    },
  );

  it('presets 5xx responses', async () => {
    const service = createServiceMock();
    service.mockDelete(500, { message: 'service failed' });

    await expect(axios.delete('/v1/key')).rejects.toMatchObject({
      response: {
        status: 500,
        data: { message: 'service failed' },
      },
    });
  });
});
