import { auditToken } from '../core/security-checker';
import { apiClient } from '../infra';

jest.mock('../infra', () => ({
  apiClient: { post: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockPost = apiClient.post as jest.Mock;

describe('auditToken', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns isHighRisk=false for a safe token', async () => {
    mockPost.mockResolvedValueOnce({
      '0xabc': {
        buy_tax: { value: '0', content: 'No buy tax', riskType: 'safe' },
        sell_tax: { value: '0', content: 'No sell tax', riskType: 'safe' },
      },
    });

    const result = await auditToken('evm--1', '0xABC');

    expect(result.isHighRisk).toBe(false);
    expect(result.riskItems).toEqual([]);
    expect(result.data).toHaveProperty('buy_tax');
    expect(mockPost).toHaveBeenCalledWith(
      'utility',
      '/utility/v2/market/token/security/batch',
      { tokenAddressList: [{ contractAddress: '0xABC', chainId: 'evm--1' }] },
    );
  });

  it('returns isHighRisk=true when riskType is "risk"', async () => {
    mockPost.mockResolvedValueOnce({
      '0xabc': {
        buy_tax: {
          value: '50',
          content: 'High buy tax',
          riskType: 'risk',
        },
        sell_tax: { value: '0', content: 'No sell tax', riskType: 'safe' },
      },
    });

    const result = await auditToken('evm--1', '0xABC');

    expect(result.isHighRisk).toBe(true);
    expect(result.riskItems).toContain('buy_tax');
  });

  it('returns isHighRisk=true for honeypot keys with truthy value', async () => {
    mockPost.mockResolvedValueOnce({
      '0xabc': {
        is_honeypot: {
          value: 'Yes',
          content: 'Honeypot detected',
          riskType: 'caution',
        },
        cannot_buy: {
          value: true,
          content: 'Cannot buy',
          riskType: 'normal',
        },
      },
    });

    const result = await auditToken('evm--1', '0xABC');

    expect(result.isHighRisk).toBe(true);
    expect(result.riskItems).toContain('is_honeypot');
    expect(result.riskItems).toContain('cannot_buy');
  });

  it('deduplicates riskItems when key has both riskType=risk and is honeypot', async () => {
    mockPost.mockResolvedValueOnce({
      '0xabc': {
        is_honeypot: {
          value: 'Yes',
          content: 'Honeypot',
          riskType: 'risk',
        },
      },
    });

    const result = await auditToken('evm--1', '0xABC');

    expect(result.isHighRisk).toBe(true);
    expect(result.riskItems.filter((k) => k === 'is_honeypot')).toHaveLength(1);
  });

  it('propagates API errors (fail-safe)', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));

    await expect(auditToken('evm--1', '0xABC')).rejects.toThrow(
      'Network error',
    );
  });

  it('throws when response is missing contract address entry (fail-safe)', async () => {
    mockPost.mockResolvedValueOnce({});

    await expect(auditToken('evm--1', '0xABC')).rejects.toThrow(
      'Security audit returned no data for 0xABC',
    );
  });
});
