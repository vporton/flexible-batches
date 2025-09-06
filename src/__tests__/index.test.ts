import * as flexibleBatches from '../index';

describe('index exports', () => {
  it('should export BatchProcessor class', () => {
    expect(flexibleBatches.BatchProcessor).toBeDefined();
    expect(typeof flexibleBatches.BatchProcessor).toBe('function');
  });

  it('should export createBatch function', () => {
    expect(flexibleBatches.createBatch).toBeDefined();
    expect(typeof flexibleBatches.createBatch).toBe('function');
  });

  it('should export processInBatches function', () => {
    expect(flexibleBatches.processInBatches).toBeDefined();
    expect(typeof flexibleBatches.processInBatches).toBe('function');
  });

  it('should have correct API surface', () => {
    const exports = Object.keys(flexibleBatches);
    expect(exports).toEqual([
      'BatchProcessor',
      'createBatch',
      'processInBatches',
    ]);
  });
});
