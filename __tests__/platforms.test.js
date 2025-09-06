import { PLATFORM_DEFINITIONS, getPlatformByDomain, getAllSupportedDomains, isSiteSupported } from '../src/platforms.js';

describe('platforms definitions', () => {
  test('has expected platform ids', () => {
    expect(Object.keys(PLATFORM_DEFINITIONS)).toEqual(
      expect.arrayContaining(['0755tt', 'smartedu'])
    );
  });

  test('getPlatformByDomain finds known domain', () => {
    const p = getPlatformByDomain('www.smartedu.cn');
    expect(p).toBeTruthy();
    expect(p.id).toBe('smartedu');
  });

  test('getAllSupportedDomains aggregates all domains', () => {
    const domains = getAllSupportedDomains();
    expect(domains).toEqual(
      expect.arrayContaining(['www.0755tt.com', 'www.smartedu.cn'])
    );
  });

  test('isSiteSupported returns false for unknown domain', () => {
    expect(isSiteSupported('example.com')).toBe(false);
  });
});

