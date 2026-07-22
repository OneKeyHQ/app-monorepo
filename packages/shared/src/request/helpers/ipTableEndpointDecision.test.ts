import { decideEndpoint } from './ipTableEndpointDecision';

const base = {
  currentSelection: undefined as string | undefined,
  domainFailingRealTraffic: false,
  strictMode: false,
  improvementThreshold: 0.3,
};

describe('decideEndpoint', () => {
  it('incident regression: domain failing real traffic beats 30% threshold', () => {
    // 2026-07-16 incident: domain probe 813ms OK, IPs only ~25% faster,
    // but real traffic on the direct domain had failed 23 times in a row.
    const d = decideEndpoint({
      ...base,
      domainLatency: 813,
      ipLatencies: { '216.19.2.116': 610, '104.18.20.233': 640 },
      currentSelection: '',
      domainFailingRealTraffic: true,
    });
    expect(d).toEqual({
      action: 'select_ip',
      ip: '216.19.2.116',
      reason: 'domain_failing',
    });
  });

  it('domain probe failed entirely -> best finite ip', () => {
    const d = decideEndpoint({
      ...base,
      domainLatency: Infinity,
      ipLatencies: { 'a': Infinity, 'b': 500 },
    });
    expect(d).toEqual({
      action: 'select_ip',
      ip: 'b',
      reason: 'domain_probe_failed',
    });
  });

  it('everything failed -> no_change (keep whatever we had)', () => {
    const d = decideEndpoint({
      ...base,
      domainLatency: Infinity,
      ipLatencies: { 'a': Infinity },
      currentSelection: 'a',
    });
    expect(d).toEqual({ action: 'no_change', reason: 'all_failed' });
  });

  it('all ips failed, domain alive -> domain', () => {
    const d = decideEndpoint({
      ...base,
      domainLatency: 300,
      ipLatencies: { 'a': Infinity },
    });
    expect(d).toEqual({ action: 'select_domain', reason: 'all_ip_failed' });
  });

  it('strict mode always picks best ip when one is finite', () => {
    const d = decideEndpoint({
      ...base,
      strictMode: true,
      domainLatency: 100,
      ipLatencies: { 'a': 900 },
    });
    expect(d).toEqual({ action: 'select_ip', ip: 'a', reason: 'strict' });
  });

  it('fresh choice: ip must be >30% faster to win', () => {
    const faster = decideEndpoint({
      ...base,
      domainLatency: 1000,
      ipLatencies: { 'a': 650 },
    });
    expect(faster).toEqual({ action: 'select_ip', ip: 'a', reason: 'faster' });

    const competitive = decideEndpoint({
      ...base,
      domainLatency: 1000,
      ipLatencies: { 'a': 750 },
    });
    expect(competitive).toEqual({
      action: 'select_domain',
      reason: 'competitive',
    });
  });

  it('sticky: healthy current ip is kept unless domain is 30% faster', () => {
    // domain 800 vs current ip 900 — domain only ~11% faster: keep ip.
    const keep = decideEndpoint({
      ...base,
      domainLatency: 800,
      ipLatencies: { 'cur': 900, 'other': 850 },
      currentSelection: 'cur',
    });
    expect(keep).toEqual({ action: 'select_ip', ip: 'cur', reason: 'sticky' });

    // domain 500 vs ip 900 — domain ~44% faster: switch back to domain.
    const back = decideEndpoint({
      ...base,
      domainLatency: 500,
      ipLatencies: { 'cur': 900 },
      currentSelection: 'cur',
    });
    expect(back).toEqual({ action: 'select_domain', reason: 'faster' });
  });

  it('sticky among ips: another ip must beat current by 30% to displace it', () => {
    const keep = decideEndpoint({
      ...base,
      domainLatency: 2000,
      ipLatencies: { 'cur': 600, 'other': 500 },
      currentSelection: 'cur',
    });
    expect(keep).toEqual({ action: 'select_ip', ip: 'cur', reason: 'sticky' });

    const displace = decideEndpoint({
      ...base,
      domainLatency: 2000,
      ipLatencies: { 'cur': 600, 'other': 300 },
      currentSelection: 'cur',
    });
    expect(displace).toEqual({
      action: 'select_ip',
      ip: 'other',
      reason: 'faster',
    });
  });

  it('current ip dead -> fresh comparison between best ip and domain', () => {
    const d = decideEndpoint({
      ...base,
      domainLatency: 400,
      ipLatencies: { 'cur': Infinity, 'other': 500 },
      currentSelection: 'cur',
    });
    expect(d).toEqual({ action: 'select_domain', reason: 'competitive' });
  });

  it('explicitly staying on domain reports sticky', () => {
    const d = decideEndpoint({
      ...base,
      domainLatency: 1000,
      ipLatencies: { 'a': 900 },
      currentSelection: '',
    });
    expect(d).toEqual({ action: 'select_domain', reason: 'sticky' });
  });

  it('domain failing overrides sticky-domain even without probe advantage', () => {
    const d = decideEndpoint({
      ...base,
      domainLatency: 300,
      ipLatencies: { 'a': 900 },
      currentSelection: '',
      domainFailingRealTraffic: true,
    });
    expect(d).toEqual({
      action: 'select_ip',
      ip: 'a',
      reason: 'domain_failing',
    });
  });
});
