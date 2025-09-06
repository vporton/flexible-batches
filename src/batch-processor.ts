import type {
  BatchOptions,
  ProcessorFunction,
  BatchProcessor as IBatchProcessor,
} from './types';

/**
 * Default batch processing options
 */
const DEFAULT_OPTIONS: BatchOptions = {
  batchSize: 10,
  delay: 0,
  concurrency: 1,
  stopOnError: false,
};

/**
 * A flexible batch processor for handling large datasets
 */
export class BatchProcessor<T, R> implements IBatchProcessor<T, R> {
  private options: BatchOptions;
  private processorFn: ProcessorFunction<T, R>;

  constructor(
    processorFn: ProcessorFunction<T, R>,
    options: Partial<BatchOptions> = {}
  ) {
    this.processorFn = processorFn;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process items in batches
   */
  async process(items: T[]): Promise<R[]> {
    const results: R[] = [];
    const batches = this.createBatches(items);
    const { concurrency = 1, delay = 0, stopOnError = false } = this.options;

    if (concurrency === 1) {
      // Sequential processing
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        try {
          const batchResults = await this.processBatch(
            batch,
            i * this.options.batchSize
          );
          results.push(...batchResults);
          this.reportProgress(results.length, items.length);

          if (delay > 0 && i < batches.length - 1) {
            await this.sleep(delay);
          }
        } catch (error) {
          if (stopOnError) {
            throw error;
          }
          // Continue with next batch if stopOnError is false
        }
      }
    } else {
      // Concurrent processing
      await this.processConcurrent(batches, results, items.length);
    }

    return results;
  }

  /**
   * Update batch options
   */
  updateOptions(options: Partial<BatchOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current batch options
   */
  getOptions(): BatchOptions {
    return { ...this.options };
  }

  /**
   * Create batches from items array
   */
  private createBatches(items: T[]): T[][] {
    const batches: T[][] = [];
    const { batchSize } = this.options;

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Process a single batch
   */
  private async processBatch(batch: T[], startIndex: number): Promise<R[]> {
    const promises = batch.map(async (item, index) => {
      try {
        return await this.processorFn(item, startIndex + index);
      } catch (error) {
        const actualError =
          error instanceof Error ? error : new Error(String(error));
        this.options.onError?.(actualError, item, startIndex + index);

        if (this.options.stopOnError) {
          throw actualError;
        }

        return null as R; // Return null for failed items when not stopping on error
      }
    });

    const results = await Promise.all(promises);
    return results.filter((result) => result !== null) as R[];
  }

  /**
   * Process batches concurrently
   */
  private async processConcurrent(
    batches: T[][],
    results: R[],
    totalItems: number
  ): Promise<void> {
    const { concurrency = 1, delay = 0 } = this.options;
    let batchIndex = 0;
    const activeBatches = new Set<Promise<void>>();

    while (batchIndex < batches.length || activeBatches.size > 0) {
      // Start new batches up to concurrency limit
      while (activeBatches.size < concurrency && batchIndex < batches.length) {
        const currentBatchIndex = batchIndex;
        const batch = batches[currentBatchIndex];

        const batchPromise = this.processBatch(
          batch,
          currentBatchIndex * this.options.batchSize
        )
          .then((batchResults) => {
            results.push(...batchResults);
            this.reportProgress(results.length, totalItems);
          })
          .catch((error) => {
            if (this.options.stopOnError) {
              throw error;
            }
          })
          .finally(() => {
            activeBatches.delete(batchPromise);
          });

        activeBatches.add(batchPromise);
        batchIndex++;

        if (delay > 0 && batchIndex < batches.length) {
          await this.sleep(delay);
        }
      }

      // Wait for at least one batch to complete
      if (activeBatches.size > 0) {
        await Promise.race(activeBatches);
      }
    }
  }

  /**
   * Report progress if callback is provided
   */
  private reportProgress(completed: number, total: number): void {
    this.options.onProgress?.(completed, total);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
