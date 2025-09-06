import '../src/registry.js';

const getRegistry = () => window.DeepLearn && window.DeepLearn.registry;

describe('registry', () => {
  beforeEach(() => {
    const registry = getRegistry();
    registry.sites.length = 0;
  });

  test('register adds site to list', () => {
    const registry = getRegistry();
    const site = { id: 's1', name: 'Site 1', matches: () => false };
    registry.register(site);
    expect(registry.sites).toContain(site);
  });

  test('resolve returns matching site for given location', () => {
    const registry = getRegistry();
    const loc = { hostname: 'match.example.com', href: 'https://match.example.com/a' };
    const site = { id: 's1', name: 'Site 1', matches: (l) => l.hostname === 'match.example.com' };
    registry.register(site);

    const resolved = registry.resolve(loc);
    expect(resolved).toBe(site);
  });

  test('resolve returns undefined when no site matches', () => {
    const registry = getRegistry();
    const loc = { hostname: 'nope.example.com' };
    const site = { id: 's1', name: 'Site 1', matches: (l) => l.hostname === 'match.example.com' };
    registry.register(site);

    const resolved = registry.resolve(loc);
    expect(resolved).toBeUndefined();
  });

  test('resolve returns first matching site when multiple match', () => {
    const registry = getRegistry();
    const loc = { hostname: 'x.example.com' };
    const first = { id: 'first', matches: () => true };
    const second = { id: 'second', matches: () => true };
    registry.register(first);
    registry.register(second);

    const resolved = registry.resolve(loc);
    expect(resolved).toBe(first);
  });
});

