import type {
  IIpTableEndpointDecision,
  IIpTableEndpointDecisionInput,
} from '../types/ipTable';

function findBestIp(
  ipLatencies: Record<string, number>,
): { ip: string; latency: number } | null {
  let best: { ip: string; latency: number } | null = null;
  for (const [ip, latency] of Object.entries(ipLatencies)) {
    if (latency !== Infinity && (!best || latency < best.latency)) {
      best = { ip, latency };
    }
  }
  return best;
}

function isSignificantlyFaster(
  candidate: number,
  incumbent: number,
  threshold: number,
): boolean {
  if (incumbent === Infinity) {
    return candidate !== Infinity;
  }
  if (candidate === Infinity) {
    return false;
  }
  return (incumbent - candidate) / incumbent > threshold;
}

/**
 * Pure endpoint selection. Priorities:
 *   1. Reachability beats latency: a direct domain that is failing real
 *      traffic never wins against any reachable IP.
 *   2. Hysteresis: the current healthy endpoint keeps its seat unless a
 *      challenger is `improvementThreshold` faster (both directions).
 *   3. The latency threshold only applies to fresh choices between two
 *      healthy candidates.
 */
export function decideEndpoint(
  input: IIpTableEndpointDecisionInput,
): IIpTableEndpointDecision {
  const {
    domainLatency,
    ipLatencies,
    currentSelection,
    domainFailingRealTraffic,
    strictMode,
    improvementThreshold,
  } = input;

  const bestIp = findBestIp(ipLatencies);

  // Nothing reachable at all — keep the previous selection untouched.
  if (domainLatency === Infinity && !bestIp) {
    return { action: 'no_change', reason: 'all_failed' };
  }

  // Reachability first: domain probes all failed.
  if (domainLatency === Infinity && bestIp) {
    return {
      action: 'select_ip',
      ip: bestIp.ip,
      reason: 'domain_probe_failed',
    };
  }

  // All IPs failed; domain is the only reachable endpoint.
  if (!bestIp) {
    return { action: 'select_domain', reason: 'all_ip_failed' };
  }

  if (strictMode) {
    return { action: 'select_ip', ip: bestIp.ip, reason: 'strict' };
  }

  // Real traffic on the direct domain is failing: any reachable IP wins,
  // regardless of the latency threshold. A health probe succeeding while
  // real requests fail is exactly the 2026-07-16 incident pattern.
  if (domainFailingRealTraffic) {
    return { action: 'select_ip', ip: bestIp.ip, reason: 'domain_failing' };
  }

  const currentIp =
    currentSelection && currentSelection !== '' ? currentSelection : null;
  const currentIpLatency = currentIp ? ipLatencies[currentIp] : undefined;
  const currentIpHealthy =
    currentIpLatency !== undefined && currentIpLatency !== Infinity;

  if (currentIp && currentIpHealthy) {
    // Sticky-IP: challengers must be significantly faster to displace it.
    if (
      isSignificantlyFaster(
        domainLatency,
        currentIpLatency,
        improvementThreshold,
      )
    ) {
      return { action: 'select_domain', reason: 'faster' };
    }
    if (
      bestIp.ip !== currentIp &&
      isSignificantlyFaster(
        bestIp.latency,
        currentIpLatency,
        improvementThreshold,
      )
    ) {
      return { action: 'select_ip', ip: bestIp.ip, reason: 'faster' };
    }
    return { action: 'select_ip', ip: currentIp, reason: 'sticky' };
  }

  // Fresh choice: on domain, never selected, or the current ip is dead.
  if (
    isSignificantlyFaster(bestIp.latency, domainLatency, improvementThreshold)
  ) {
    return { action: 'select_ip', ip: bestIp.ip, reason: 'faster' };
  }
  return {
    action: 'select_domain',
    reason: currentSelection === '' ? 'sticky' : 'competitive',
  };
}
