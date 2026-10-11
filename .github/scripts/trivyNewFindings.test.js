const {
  collectFindings,
  findNewFindings,
  normalizeTarget,
  renderSummary,
} = require('./trivyNewFindings');

function report(results) {
  return { SchemaVersion: 2, Results: results };
}

function vulnerability(overrides = {}) {
  return {
    VulnerabilityID: 'CVE-2026-0001',
    PkgName: 'left-pad',
    InstalledVersion: '1.0.0',
    FixedVersion: '1.0.1',
    Severity: 'HIGH',
    Title: 'left-pad: padding overflow',
    PrimaryURL: 'https://avd.aquasec.com/nvd/cve-2026-0001',
    ...overrides,
  };
}

function secret(overrides = {}) {
  return {
    RuleID: 'aws-access-key-id',
    Category: 'AWS',
    Severity: 'CRITICAL',
    Title: 'AWS Access Key ID',
    StartLine: 10,
    EndLine: 10,
    Match: 'const key = "AKIA****************"',
    ...overrides,
  };
}

function misconfiguration(overrides = {}) {
  return {
    Type: 'Dockerfile Security Check',
    ID: 'DS002',
    AVDID: 'AVD-DS-0002',
    Title: 'Image user should not be root',
    Severity: 'HIGH',
    PrimaryURL: 'https://avd.aquasec.com/misconfig/ds002',
    CauseMetadata: { StartLine: 1, EndLine: 1 },
    ...overrides,
  };
}

const baseline = report([
  {
    Target: 'yarn.lock',
    Class: 'lang-pkgs',
    Vulnerabilities: [vulnerability()],
  },
  { Target: 'packages/shared/src/a.ts', Class: 'secret', Secrets: [secret()] },
]);

function describeNew(result) {
  return result.newFindings.map(
    (finding) => `${finding.kind}:${finding.id}:${finding.location}`,
  );
}

describe('trivyNewFindings', () => {
  it('reports nothing when head and base match', () => {
    const result = findNewFindings(baseline, baseline, '');
    expect(result.newFindings).toEqual([]);
    expect(result.headCounts).toEqual({
      vulnerability: 1,
      misconfiguration: 0,
      secret: 1,
    });
  });

  it('handles reports without results', () => {
    const empty = { SchemaVersion: 2 };
    expect(findNewFindings(empty, empty, '').newFindings).toEqual([]);
    expect(findNewFindings(baseline, empty, '').newFindings).toHaveLength(2);
  });

  it('reports vulnerabilities, misconfigurations and secrets absent from base', () => {
    const head = report([
      {
        Target: 'yarn.lock',
        Class: 'lang-pkgs',
        Vulnerabilities: [
          vulnerability(),
          vulnerability({ VulnerabilityID: 'CVE-2026-0002', PkgName: 'ws' }),
        ],
      },
      {
        Target: 'packages/shared/src/a.ts',
        Class: 'secret',
        Secrets: [secret()],
      },
      {
        Target: 'apps/desktop/Dockerfile',
        Class: 'config',
        Misconfigurations: [misconfiguration()],
      },
      {
        Target: 'packages/shared/src/b.ts',
        Class: 'secret',
        Secrets: [secret({ StartLine: 3, EndLine: 3 })],
      },
    ]);
    expect(describeNew(findNewFindings(head, baseline, ''))).toEqual([
      'vulnerability:CVE-2026-0002:yarn.lock',
      'misconfiguration:AVD-DS-0002:apps/desktop/Dockerfile:1',
      'secret:aws-access-key-id:packages/shared/src/b.ts:3',
    ]);
  });

  it('ignores line moves and still-vulnerable version bumps', () => {
    const head = report([
      {
        Target: 'yarn.lock',
        Class: 'lang-pkgs',
        Vulnerabilities: [vulnerability({ InstalledVersion: '1.0.0-patched' })],
      },
      {
        Target: 'packages/shared/src/a.ts',
        Class: 'secret',
        Secrets: [secret({ StartLine: 42, EndLine: 42 })],
      },
    ]);
    expect(findNewFindings(head, baseline, '').newFindings).toEqual([]);
  });

  it('reports extra occurrences of a fingerprint already on base', () => {
    const head = report([
      {
        Target: 'yarn.lock',
        Class: 'lang-pkgs',
        Vulnerabilities: [
          vulnerability(),
          vulnerability({ InstalledVersion: '2.0.0' }),
        ],
      },
      {
        Target: 'packages/shared/src/a.ts',
        Class: 'secret',
        Secrets: [secret(), secret({ StartLine: 20, EndLine: 20 })],
      },
    ]);
    const result = findNewFindings(head, baseline, '');
    expect(describeNew(result)).toEqual([
      'vulnerability:CVE-2026-0001:yarn.lock',
      'secret:aws-access-key-id:packages/shared/src/a.ts:20',
    ]);
    expect(result.newFindings[0].subject).toBe('left-pad@2.0.0');
  });

  it('does not report when head has fewer occurrences than base', () => {
    const base = report([
      {
        Target: 'yarn.lock',
        Class: 'lang-pkgs',
        Vulnerabilities: [vulnerability()],
      },
      {
        Target: 'packages/shared/src/a.ts',
        Class: 'secret',
        Secrets: [secret(), secret({ StartLine: 20, EndLine: 20 })],
      },
    ]);
    expect(findNewFindings(baseline, base, '').newFindings).toEqual([]);
  });

  it('strips the base checkout prefix from base targets only', () => {
    const base = report([
      {
        Target: '.trivy-base/yarn.lock',
        Class: 'lang-pkgs',
        Vulnerabilities: [vulnerability()],
      },
      {
        Target: '.trivy-base/packages/shared/src/a.ts',
        Class: 'secret',
        Secrets: [secret()],
      },
    ]);
    expect(findNewFindings(baseline, base, '.trivy-base').newFindings).toEqual(
      [],
    );
    expect(findNewFindings(baseline, base, '').newFindings).toHaveLength(2);
    expect(normalizeTarget('yarn.lock', '.trivy-base')).toBe('yarn.lock');
    expect(normalizeTarget('.trivy-base/yarn.lock', '.trivy-base/')).toBe(
      'yarn.lock',
    );
  });

  it('keys misconfigurations by resource and never prints secret matches', () => {
    const findings = collectFindings(
      report([
        {
          Target: 'infra/main.tf',
          Class: 'config',
          Misconfigurations: [
            misconfiguration({
              ID: 'AVD-AWS-0001',
              CauseMetadata: { Resource: 'aws_s3_bucket.a', StartLine: 1 },
            }),
            misconfiguration({
              ID: 'AVD-AWS-0001',
              CauseMetadata: { Resource: 'aws_s3_bucket.b', StartLine: 9 },
            }),
          ],
        },
        {
          Target: 'packages/shared/src/a.ts',
          Class: 'secret',
          Secrets: [secret({ Match: 'token = "ghp_****"' })],
        },
      ]),
      '',
    );
    expect(new Set(findings.map((finding) => finding.key)).size).toBe(3);
    const summary = renderSummary({
      newFindings: findings,
      headCounts: { vulnerability: 0, misconfiguration: 2, secret: 1 },
      baseCounts: { vulnerability: 0, misconfiguration: 0, secret: 0 },
    });
    expect(summary).not.toContain('ghp_');
    expect(summary).toContain('`infra/main.tf:9`');
  });

  it('escapes pipes and backslashes inside table cells', () => {
    const summary = renderSummary({
      newFindings: [
        {
          kind: 'vulnerability',
          severity: 'HIGH',
          id: 'CVE-1',
          subject: 'a|b@1.0.0',
          location: 'dir\\file.lock',
          title: 'back\\slash | pipe\nsecond line',
          fixedVersion: '',
          url: '',
        },
      ],
      headCounts: { vulnerability: 1, misconfiguration: 0, secret: 0 },
      baseCounts: { vulnerability: 0, misconfiguration: 0, secret: 0 },
    });
    const row = summary
      .split('\n')
      .find((line) => line.startsWith('| vulnerability'));
    expect(row).toBe(
      '| vulnerability | HIGH | CVE-1 | `a\\|b@1.0.0` | `dir\\\\file.lock` | back\\\\slash \\| pipe second line |',
    );
    expect(row.split(/(?<!\\)\|/)).toHaveLength(8);
  });
});
