/**
 * Flexible Batches - A TypeScript library for flexible batch processing
 */

export { BatchProcessor } from './batch-processor';
export { createBatch, processInBatches } from './utils';
export type {
  BatchOptions,
  BatchProcessor as IBatchProcessor,
  ProcessorFunction,
} from './types';
