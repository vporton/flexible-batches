import { createBatch, processInBatches, chunk, delay, retry } from '../utils';

describe('utils', () => {
  describe('createBatch', () => {
    it('should create a BatchProcessor instance', () => {
      const processor = (item: number) => item * 2;
      const batchProcessor = createBatch(processor, { batchSize: 5 });

      expect(batchProcessor).toBeDefined();
      expect(batchProcessor.getOptions().batchSize).toBe(5);
    });
  });

  describe('processInBatches', () => {
    it('should process items in batches', async () => {
      const processor = (item: number) => item * 2;
      const items = [1, 2, 3, 4, 5];

      const results = await processInBatches(items, processor, {
        batchSize: 2,
      });

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it('should work with async processor', async () => {
      const processor = async (item: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return item * 3;
      };

      const results = await processInBatches([1, 2, 3], processor);

      expect(results).toEqual([3, 6, 9]);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks of specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7];
      const chunks = chunk(array, 3);

      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it('should handle empty array', () => {
      const chunks = chunk([], 3);
      expect(chunks).toEqual([]);
    });

    it('should handle array smaller than chunk size', () => {
      const chunks = chunk([1, 2], 5);
      expect(chunks).toEqual([[1, 2]]);
    });

    it('should handle chunk size of 1', () => {
      const chunks = chunk([1, 2, 3], 1);
      expect(chunks).toEqual([[1], [2], [3]]);
    });
  });

  describe('delay', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow some timing variance
    });
  });

  describe('retry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValue('success');

      const result = await retry(fn, 3, 10); // Small delay for testing

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(retry(fn, 2, 10)).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockResolvedValue('success');

      const start = Date.now();
      await retry(fn, 3, 50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // At least base delay
    });

    it('should handle non-Error rejections', async () => {
      const fn = jest.fn().mockRejectedValue('string error');

      await expect(retry(fn, 1, 10)).rejects.toThrow('string error');
    });
  });
});
