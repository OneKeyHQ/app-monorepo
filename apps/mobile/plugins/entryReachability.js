/**
 * Entry Reachability (Union Graph)
 *
 * BFS from each entry point to compute which modules are reachable.
 * Used to determine runtime ownership:
 *   - mainReachable && !bgReachable → main-only
 *   - !mainReachable && bgReachable → bg-only
 *   - both → shared
 */

function computeReachable(graph, entryPoint) {
  const reachable = new Set();
  const queue = [entryPoint];
  while (queue.length > 0) {
    const current = queue.shift();
    if (reachable.has(current)) continue;
    reachable.add(current);
    const mod = graph.dependencies.get(current);
    if (!mod) continue;
    for (const [, dep] of mod.dependencies) {
      if (!reachable.has(dep.absolutePath)) {
        queue.push(dep.absolutePath);
      }
    }
  }
  return reachable;
}

function computeEntryReachability(graph, mainEntry, bgEntry) {
  const mainReachable = computeReachable(graph, mainEntry);
  const bgReachable = computeReachable(graph, bgEntry);

  const mainOnly = new Set();
  const bgOnly = new Set();
  const shared = new Set();

  for (const [absPath] of graph.dependencies) {
    const fromMain = mainReachable.has(absPath);
    const fromBg = bgReachable.has(absPath);
    if (fromMain && fromBg) shared.add(absPath);
    else if (fromMain) mainOnly.add(absPath);
    else if (fromBg) bgOnly.add(absPath);
  }

  return { mainReachable, bgReachable, mainOnly, bgOnly, shared };
}

module.exports = { computeReachable, computeEntryReachability };
