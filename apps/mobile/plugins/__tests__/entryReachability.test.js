const {
  computeReachable,
  computeEntryReachability,
} = require('../entryReachability');

function makeGraph(edges) {
  // edges: { 'a': ['b','c'], 'b': ['d'], ... }
  const deps = new Map();
  for (const [mod, children] of Object.entries(edges)) {
    const depsMap = new Map();
    (children || []).forEach((child, i) => {
      depsMap.set(`dep${i}`, { absolutePath: child, data: { data: {} } });
    });
    deps.set(mod, { dependencies: depsMap });
  }
  return { dependencies: deps };
}

describe('computeReachable', () => {
  it('returns entry and all transitive deps', () => {
    const graph = makeGraph({ a: ['b', 'c'], b: ['d'], c: [], d: [] });
    const r = computeReachable(graph, 'a');
    expect(r).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('handles cycles', () => {
    const graph = makeGraph({ a: ['b'], b: ['a'] });
    const r = computeReachable(graph, 'a');
    expect(r).toEqual(new Set(['a', 'b']));
  });

  it('handles isolated nodes', () => {
    const graph = makeGraph({ a: [], b: [] });
    const r = computeReachable(graph, 'a');
    expect(r).toEqual(new Set(['a']));
  });

  it('handles missing nodes gracefully', () => {
    const graph = makeGraph({ a: ['b'] });
    // 'b' is referenced but not in the graph dependencies
    const r = computeReachable(graph, 'a');
    expect(r).toEqual(new Set(['a', 'b']));
  });
});

describe('computeEntryReachability', () => {
  it('classifies main-only, bg-only, shared', () => {
    const graph = makeGraph({
      main: ['shared', 'mainOnly'],
      bg: ['shared', 'bgOnly'],
      shared: [],
      mainOnly: [],
      bgOnly: [],
    });
    const r = computeEntryReachability(graph, 'main', 'bg');
    expect(r.shared.has('shared')).toBe(true);
    expect(r.mainOnly.has('mainOnly')).toBe(true);
    expect(r.bgOnly.has('bgOnly')).toBe(true);
  });

  it('entry points themselves are classified as shared when both exist', () => {
    const graph = makeGraph({
      main: ['lib'],
      bg: ['lib'],
      lib: [],
    });
    const r = computeEntryReachability(graph, 'main', 'bg');
    expect(r.mainOnly.has('main')).toBe(true);
    expect(r.bgOnly.has('bg')).toBe(true);
    expect(r.shared.has('lib')).toBe(true);
  });

  it('handles diamond dependencies', () => {
    // main → a → c
    // bg   → b → c
    const graph = makeGraph({
      main: ['a'],
      bg: ['b'],
      a: ['c'],
      b: ['c'],
      c: [],
    });
    const r = computeEntryReachability(graph, 'main', 'bg');
    expect(r.shared.has('c')).toBe(true);
    expect(r.mainOnly.has('a')).toBe(true);
    expect(r.bgOnly.has('b')).toBe(true);
  });
});
