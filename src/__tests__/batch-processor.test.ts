import { BatchProcessor } from '../batch-processor';
import type { ProcessorFunction } from '../types';

describe('BatchProcessor', () => {
  const mockProcessor: ProcessorFunction<number, number> = async (
    item: number
  ) => item * 2;
  const syncProcessor: ProcessorFunction<number, number> = (item: number) =>
    item * 2;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a BatchProcessor with default options', () => {
      const processor = new BatchProcessor(mockProcessor);
      const options = processor.getOptions();

      expect(options.batchSize).toBe(10);
      expect(options.delay).toBe(0);
      expect(options.concurrency).toBe(1);
      expect(options.stopOnError).toBe(false);
    });

    it('should create a BatchProcessor with custom options', () => {
      const customOptions = {
        batchSize: 5,
        delay: 100,
        concurrency: 2,
        stopOnError: true,
      };

      const processor = new BatchProcessor(mockProcessor, customOptions);
      const options = processor.getOptions();

      expect(options.batchSize).toBe(5);
      expect(options.delay).toBe(100);
      expect(options.concurrency).toBe(2);
      expect(options.stopOnError).toBe(true);
    });
  });

  describe('process', () => {
    it('should process items in batches sequentially', async () => {
      const processor = new BatchProcessor(syncProcessor, { batchSize: 3 });
      const items = [1, 2, 3, 4, 5, 6, 7];

      const results = await processor.process(items);

      expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
    });

    it('should process items with async processor', async () => {
      const processor = new BatchProcessor(mockProcessor, { batchSize: 2 });
      const items = [1, 2, 3, 4];

      const results = await processor.process(items);

      expect(results).toEqual([2, 4, 6, 8]);
    });

    it('should handle empty array', async () => {
      const processor = new BatchProcessor(mockProcessor);
      const results = await processor.process([]);

      expect(results).toEqual([]);
    });

    it('should call progress callback', async () => {
      const onProgress = jest.fn();
      const processor = new BatchProcessor(syncProcessor, {
        batchSize: 2,
        onProgress,
      });

      await processor.process([1, 2, 3, 4]);

      expect(onProgress).toHaveBeenCalledWith(2, 4);
      expect(onProgress).toHaveBeenCalledWith(4, 4);
    });

    it('should handle errors without stopping when stopOnError is false', async () => {
      const errorProcessor: ProcessorFunction<number, number> = async (
        item: number
      ) => {
        if (item === 3) {
          throw new Error('Test error');
        }
        return item * 2;
      };

      const onError = jest.fn();
      const processor = new BatchProcessor(errorProcessor, {
        batchSize: 2,
        stopOnError: false,
        onError,
      });

      const results = await processor.process([1, 2, 3, 4]);

      expect(results).toEqual([2, 4, 8]); // Item 3 should be filtered out
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 3, 2);
    });

    it('should stop on first error when stopOnError is true', async () => {
      const errorProcessor: ProcessorFunction<number, number> = async (
        item: number
      ) => {
        if (item === 2) {
          throw new Error('Test error');
        }
        return item * 2;
      };

      const processor = new BatchProcessor(errorProcessor, {
        batchSize: 2,
        stopOnError: true,
      });

      await expect(processor.process([1, 2, 3, 4])).rejects.toThrow(
        'Test error'
      );
    });

    it('should respect delay between batches', async () => {
      const start = Date.now();
      const processor = new BatchProcessor(syncProcessor, {
        batchSize: 2,
        delay: 100,
      });

      await processor.process([1, 2, 3, 4]);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(100); // At least one delay
    });
  });

  describe('updateOptions', () => {
    it('should update options', () => {
      const processor = new BatchProcessor(mockProcessor);

      processor.updateOptions({ batchSize: 20, delay: 50 });
      const options = processor.getOptions();

      expect(options.batchSize).toBe(20);
      expect(options.delay).toBe(50);
      expect(options.concurrency).toBe(1); // Should keep existing values
    });
  });

  describe('concurrent processing', () => {
    it('should process batches concurrently', async () => {
      const delayedProcessor: ProcessorFunction<number, number> = async (
        item: number
      ) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return item * 2;
      };

      const processor = new BatchProcessor(delayedProcessor, {
        batchSize: 2,
        concurrency: 2,
      });

      const start = Date.now();
      const results = await processor.process([1, 2, 3, 4]);
      const elapsed = Date.now() - start;

      expect(results).toEqual([2, 4, 6, 8]);
      // With concurrency=2, should be faster than sequential
      expect(elapsed).toBeLessThan(150); // Should be less than 3 * 50ms
    });
  });
});
