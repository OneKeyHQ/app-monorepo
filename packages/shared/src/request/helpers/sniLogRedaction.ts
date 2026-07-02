const IPV4_RE =
  /(^|[^\d.])((?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3})(?=$|[^\d.])/g;

const IPV4_LITERAL_RE =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

const BRACKETED_IPV6_RE =
  /\[([0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*)\](?=$|:\d{1,5}\b|[^0-9A-Fa-f:.\]])/g;

const IPV6_CANDIDATE_RE =
  /(^|[^0-9A-Fa-f:.[])(\[?[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*\]?)(?=$|[^0-9A-Fa-f:.\]])/g;

function isLikelyIpv6Literal(candidate: string): boolean {
  const value =
    candidate.startsWith('[') && candidate.endsWith(']')
      ? candidate.slice(1, -1)
      : candidate;
  const parts = value.split(':');
  const doubleColonCount = value.split('::').length - 1;

  if (
    doubleColonCount > 1 ||
    value.includes(':::') ||
    !/^[0-9A-Fa-f:.]+$/.test(value)
  ) {
    return false;
  }

  const hasDoubleColon = value.includes('::');
  const hasEmbeddedIpv4 = value.includes('.');
  const groupCount = parts.reduce((count, part, index) => {
    if (part === '') return count;
    if (part.includes('.')) {
      return index === parts.length - 1 && IPV4_LITERAL_RE.test(part)
        ? count + 2
        : Number.POSITIVE_INFINITY;
    }
    return /^[0-9A-Fa-f]{1,4}$/.test(part)
      ? count + 1
      : Number.POSITIVE_INFINITY;
  }, 0);

  if (!Number.isFinite(groupCount)) return false;
  if (hasEmbeddedIpv4 && !IPV4_LITERAL_RE.test(parts.at(-1) ?? '')) {
    return false;
  }
  return hasDoubleColon ? groupCount < 8 : groupCount === 8;
}

export function redactIpLiterals(value: string): string {
  return value
    .replace(BRACKETED_IPV6_RE, (match, candidate: string) =>
      isLikelyIpv6Literal(candidate) ? '<ip6>' : match,
    )
    .replace(IPV6_CANDIDATE_RE, (_match, prefix: string, candidate: string) =>
      isLikelyIpv6Literal(candidate)
        ? `${prefix}<ip6>`
        : `${prefix}${candidate}`,
    )
    .replace(IPV4_RE, '$1<ip>');
}

export function safeSniLogValue(value: unknown): string {
  if (value === null || value === undefined) return 'none';
  return redactIpLiterals(String(value)).replace(/[\r\n\s]+/g, '_');
}
