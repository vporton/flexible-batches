import { BatchProcessor } from './batch-processor';
import type { BatchOptions, ProcessorFunction } from './types';

/**
 * Create a new batch processor instance
 */
export function createBatch<T, R>(
  processorFn: ProcessorFunction<T, R>,
  options?: Partial<BatchOptions>
): BatchProcessor<T, R> {
  return new BatchProcessor(processorFn, options);
}

/**
 * Utility function to process items in batches (one-time use)
 */
export async function processInBatches<T, R>(
  items: T[],
  processorFn: ProcessorFunction<T, R>,
  options?: Partial<BatchOptions>
): Promise<R[]> {
  const processor = createBatch(processorFn, options);
  return processor.process(items);
}

/**
 * Split an array into chunks of specified size
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Create a delay function
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delayMs = baseDelay * Math.pow(2, attempt - 1);
      await delay(delayMs);
    }
  }

  throw lastError!;
}
