/**
 * Configuration options for batch processing
 */
export interface BatchOptions {
  /** The size of each batch */
  batchSize: number;
  /** Delay between batches in milliseconds */
  delay?: number;
  /** Maximum number of concurrent batches */
  concurrency?: number;
  /** Whether to stop processing on first error */
  stopOnError?: boolean;
  /** Progress callback function */
  onProgress?: (completed: number, total: number) => void;
  /** Error callback function */
  onError?: (error: Error, item: unknown, index: number) => void;
}

/**
 * Function that processes a single item
 */
export type ProcessorFunction<T, R> = (
  item: T,
  index: number
) => Promise<R> | R;

/**
 * Interface for batch processors
 */
export interface BatchProcessor<T, R> {
  /**
   * Process items in batches
   */
  process(items: T[]): Promise<R[]>;

  /**
   * Update batch options
   */
  updateOptions(options: Partial<BatchOptions>): void;

  /**
   * Get current batch options
   */
  getOptions(): BatchOptions;
}
