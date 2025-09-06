import '../src/bank.js';

const getBank = () => window.DeepLearn && window.DeepLearn.bank;

describe('bank', () => {
  test('mergeBanks merges and overwrites by source', () => {
    const bank = getBank();
    const target = new Map([
      ['Q1', 'A'],
      ['Q2', 'B'],
    ]);
    const source = new Map([
      ['Q2', 'C'], // overwrite
      ['Q3', 'T'], // new
    ]);

    const result = bank.mergeBanks(target, source);
    expect(result).toBe(target);
    expect([...result.entries()]).toEqual([
      ['Q1', 'A'],
      ['Q2', 'C'],
      ['Q3', 'T'],
    ]);
  });

  test('getStats counts types correctly', () => {
    const bank = getBank();
    const map = new Map([
      ['True statement', 'T'],
      ['False statement', 'F'],
      ['Multi choice', 'A,B'],
      ['Single choice', 'D'],
    ]);

    const stats = bank.getStats(map);
    expect(stats).toEqual({
      total: 4,
      trueCount: 1,
      falseCount: 1,
      multiChoice: 1,
      singleChoice: 1,
    });
  });

  test('getStats handles empty bank', () => {
    const bank = getBank();
    const stats = bank.getStats(new Map());
    expect(stats).toEqual({
      total: 0,
      trueCount: 0,
      falseCount: 0,
      multiChoice: 0,
      singleChoice: 0,
    });
  });

  test('exportToJson creates blob URL, clicks anchor, and revokes', () => {
    const bank = getBank();
    const map = new Map([
      ['Q1', 'A'],
      ['Q2', 'B'],
    ]);

    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const createUrl = jest.fn().mockReturnValue('blob:mock');
    const revokeUrl = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });

    const origCreate = document.createElement.bind(document);
    let createdAnchor;
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        createdAnchor = el;
        el.click = jest.fn();
      }
      return el;
    });

    bank.exportToJson(map, 'out.json');

    expect(createUrl).toHaveBeenCalled();
    // First arg is a Blob
    const blobArg = createUrl.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(createdAnchor.download).toBe('out.json');
    expect(createdAnchor.href).toBe('blob:mock');
    expect(createdAnchor.click).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:mock');

    // Restore mocks
    document.createElement.mockRestore();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreate });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevoke });
  });
});
