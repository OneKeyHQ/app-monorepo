import { auditToken, classifySecurityData } from '../core/security-checker';
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
    expect(result.cautionItems).toEqual([]);
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

  it('returns cautionItems for caution riskType', async () => {
    mockPost.mockResolvedValueOnce({
      '0xabc': {
        owner_change: {
          value: '1',
          content: 'Owner can change',
          riskType: 'caution',
        },
        buy_tax: { value: '0', content: 'No buy tax', riskType: 'safe' },
      },
    });

    const result = await auditToken('evm--1', '0xABC');

    expect(result.isHighRisk).toBe(false);
    expect(result.cautionItems).toContain('owner_change');
    expect(result.riskItems).toEqual([]);
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
    expect(result.cautionItems).toContain('is_honeypot');
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

  it('throws when audit data is empty object (fail-closed)', async () => {
    mockPost.mockResolvedValueOnce({ '0xabc': {} });

    await expect(auditToken('evm--1', '0xABC')).rejects.toThrow(
      'Security audit returned empty result for 0xABC',
    );
  });

  it('throws on malformed security item', async () => {
    mockPost.mockResolvedValueOnce({
      '0xabc': {
        buy_tax: { value: '0' },
      },
    });

    await expect(auditToken('evm--1', '0xABC')).rejects.toThrow(
      'Malformed security item',
    );
  });

  it('resolves address with original case when API returns checksum key', async () => {
    mockPost.mockResolvedValueOnce({
      '0xAbC': {
        buy_tax: { value: '0', content: 'No buy tax', riskType: 'safe' },
      },
    });

    const result = await auditToken('evm--1', '0xAbC');

    expect(result.isHighRisk).toBe(false);
    expect(result.data).toHaveProperty('buy_tax');
  });
});

describe('trust_list downgrade', () => {
  it('downgrades owner_change_balance from risk to caution when trust_list is Yes', () => {
    const result = classifySecurityData({
      owner_change_balance: {
        value: 'Yes',
        content: 'Owner can change balance',
        riskType: 'risk',
      },
      trust_list: {
        value: 'Yes',
        content: 'Trust by GoPlus',
        riskType: 'normal',
      },
      is_honeypot: {
        value: 'No',
        content: 'Is honeypot',
        riskType: 'safe',
      },
    });
    expect(result.riskItems).not.toContain('owner_change_balance');
    expect(result.cautionItems).toContain('owner_change_balance');
    expect(result.isHighRisk).toBe(false);
  });

  it('keeps owner_change_balance as risk when trust_list is not Yes', () => {
    const result = classifySecurityData({
      owner_change_balance: {
        value: 'Yes',
        content: 'Owner can change balance',
        riskType: 'risk',
      },
      trust_list: {
        value: 'No',
        content: 'Trust by GoPlus',
        riskType: 'normal',
      },
    });
    expect(result.riskItems).toContain('owner_change_balance');
    expect(result.isHighRisk).toBe(true);
  });

  it('does not downgrade is_honeypot even when trust_list is Yes', () => {
    const result = classifySecurityData({
      is_honeypot: {
        value: 'Yes',
        content: 'Is honeypot',
        riskType: 'risk',
      },
      trust_list: {
        value: 'Yes',
        content: 'Trust by GoPlus',
        riskType: 'normal',
      },
    });
    expect(result.riskItems).toContain('is_honeypot');
    expect(result.isHighRisk).toBe(true);
  });
});
