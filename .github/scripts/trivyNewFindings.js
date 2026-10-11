// Compare two Trivy JSON reports (pull request head vs. base branch) and fail
// when the head report contains HIGH/CRITICAL findings that the base does not.
//
// The GitHub code-scanning "results" check that `upload-sarif` creates on
// pull_request events is supposed to do this comparison, but once a PR diff
// exceeds GitHub's processing limit it attributes every open alert on the
// merge ref to the PR. Diffing two Trivy reports ourselves keeps the gate
// scoped to what the PR actually introduces, regardless of diff size.
//
// Usage:
//   node .github/scripts/trivyNewFindings.js <head.json> <base.json> [--strip-prefix <dir>]
//
// `--strip-prefix` removes a leading directory from base report targets when
// the base tree was scanned from a sub-directory of the workspace.
//
// Writes a Markdown summary to $GITHUB_STEP_SUMMARY when set. Exits 1 when
// new findings exist, 2 on usage or input errors.

const fs = require('fs');
const path = require('path');

const SUPPORTED_SCHEMA_VERSION = 2;

function parseArgs(argv) {
  const positional = [];
  let stripPrefix = '';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strip-prefix') {
      stripPrefix = argv[i + 1] || '';
      i += 1;
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2) {
    return null;
  }
  return { headPath: positional[0], basePath: positional[1], stripPrefix };
}

// Returns the parsed report, or null after printing a workflow error
// annotation when the file is missing, malformed, or from another Trivy
// JSON schema.
function readReport(filePath) {
  let report;
  try {
    report = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`::error title=Trivy::${filePath}: ${error.message}`);
    return null;
  }
  if (!report || report.SchemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    console.error(
      `::error title=Trivy::${filePath}: unsupported Trivy JSON SchemaVersion ${String(
        report && report.SchemaVersion,
      )} (expected ${SUPPORTED_SCHEMA_VERSION})`,
    );
    return null;
  }
  return report;
}

function normalizeTarget(target, stripPrefix) {
  const normalized = String(target || '')
    .split(path.sep)
    .join('/');
  if (!stripPrefix) {
    return normalized;
  }
  const prefix = `${stripPrefix.replace(/\/+$/, '')}/`;
  return normalized.startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized;
}

// Flatten a Trivy report into findings with a stable fingerprint that does not
// depend on line numbers, so unrelated edits in the same file do not register
// as new findings.
function collectFindings(report, stripPrefix) {
  const findings = [];
  for (const result of report.Results || []) {
    const target = normalizeTarget(result.Target, stripPrefix);

    for (const vuln of result.Vulnerabilities || []) {
      // Version is intentionally left out: bumping a package to another
      // version that is still affected by the same CVE is not a new finding.
      findings.push({
        kind: 'vulnerability',
        key: `vuln|${target}|${vuln.PkgName}|${vuln.VulnerabilityID}`,
        severity: vuln.Severity,
        id: vuln.VulnerabilityID,
        subject: `${vuln.PkgName}@${vuln.InstalledVersion}`,
        location: target,
        title: vuln.Title || '',
        fixedVersion: vuln.FixedVersion || '',
        url: vuln.PrimaryURL || '',
      });
    }

    for (const misconfiguration of result.Misconfigurations || []) {
      const cause = misconfiguration.CauseMetadata || {};
      const line = cause.StartLine ? `:${cause.StartLine}` : '';
      findings.push({
        kind: 'misconfiguration',
        key: `misconfiguration|${target}|${misconfiguration.ID}|${cause.Resource || ''}`,
        severity: misconfiguration.Severity,
        id: misconfiguration.AVDID || misconfiguration.ID,
        subject: cause.Resource || misconfiguration.Type || '',
        location: `${target}${line}`,
        title: misconfiguration.Title || '',
        url: misconfiguration.PrimaryURL || '',
      });
    }

    for (const secret of result.Secrets || []) {
      // `Match` is already redacted by Trivy; it is used for the fingerprint
      // only and never printed.
      const line = secret.StartLine ? `:${secret.StartLine}` : '';
      findings.push({
        kind: 'secret',
        key: `secret|${target}|${secret.RuleID}|${secret.Match || ''}`,
        severity: secret.Severity,
        id: secret.RuleID,
        subject: secret.Category || '',
        location: `${target}${line}`,
        title: secret.Title || '',
        url: '',
      });
    }
  }
  return findings;
}

function countByKind(findings) {
  const counts = { vulnerability: 0, misconfiguration: 0, secret: 0 };
  for (const finding of findings) {
    counts[finding.kind] += 1;
  }
  return counts;
}

function formatCounts(counts) {
  return `${counts.vulnerability} vulnerabilities, ${counts.misconfiguration} misconfigurations, ${counts.secret} secrets`;
}

// Escape backslashes before pipes so a trailing backslash cannot neutralize
// the escaped table delimiter.
function escapeCell(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function renderSummary({ newFindings, headCounts, baseCounts }) {
  const lines = ['## Trivy findings new to this pull request', ''];
  lines.push(`- Pull request head: ${formatCounts(headCounts)}`);
  lines.push(`- Base branch: ${formatCounts(baseCounts)}`);
  lines.push('');

  if (newFindings.length === 0) {
    lines.push(
      'No HIGH/CRITICAL vulnerability, misconfiguration, or secret findings are introduced by this pull request.',
    );
    lines.push('');
    return lines.join('\n');
  }

  lines.push(
    `**${newFindings.length} finding(s) exist on the pull request head but not on the base branch.**`,
  );
  lines.push('');
  lines.push('| Type | Severity | ID | Subject | Location | Title |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const finding of newFindings) {
    const id = finding.url
      ? `[${escapeCell(finding.id)}](${finding.url})`
      : escapeCell(finding.id);
    const title = finding.fixedVersion
      ? `${escapeCell(finding.title)} (fixed in ${escapeCell(
          finding.fixedVersion,
        )})`
      : escapeCell(finding.title);
    lines.push(
      `| ${finding.kind} | ${escapeCell(finding.severity)} | ${id} | \`${escapeCell(
        finding.subject,
      )}\` | \`${escapeCell(finding.location)}\` | ${title} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function findNewFindings(headReport, baseReport, stripPrefix) {
  const headFindings = collectFindings(headReport, '');
  const baseFindings = collectFindings(baseReport, stripPrefix);
  const baseKeys = new Set(baseFindings.map((finding) => finding.key));
  const seen = new Set();
  const newFindings = headFindings.filter((finding) => {
    if (baseKeys.has(finding.key) || seen.has(finding.key)) {
      return false;
    }
    seen.add(finding.key);
    return true;
  });
  return {
    newFindings,
    headCounts: countByKind(headFindings),
    baseCounts: countByKind(baseFindings),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(
      'Usage: node .github/scripts/trivyNewFindings.js <head.json> <base.json> [--strip-prefix <dir>]',
    );
    return 2;
  }

  const headReport = readReport(args.headPath);
  const baseReport = readReport(args.basePath);
  if (!headReport || !baseReport) {
    return 2;
  }
  const result = findNewFindings(headReport, baseReport, args.stripPrefix);

  const summary = renderSummary(result);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
  console.log(summary);

  if (result.newFindings.length > 0) {
    console.error(
      `::error title=Trivy::${result.newFindings.length} HIGH/CRITICAL finding(s) are new to this pull request`,
    );
    for (const finding of result.newFindings) {
      console.error(
        `  - [${finding.kind}] ${finding.severity} ${finding.id} ${finding.subject} (${finding.location})`,
      );
    }
    return 1;
  }

  console.log(
    `No new HIGH/CRITICAL findings (head: ${formatCounts(
      result.headCounts,
    )}; base: ${formatCounts(result.baseCounts)}).`,
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  collectFindings,
  findNewFindings,
  normalizeTarget,
  renderSummary,
};
