# Flexible Batches

A powerful TypeScript library for flexible batch processing with support for concurrency, error handling, and progress tracking.

## Features

- 🚀 **Flexible batch processing** - Process large datasets efficiently in configurable batches
- ⚡ **Concurrent processing** - Control concurrency levels for optimal performance
- 🛡️ **Error handling** - Robust error handling with configurable stop-on-error behavior
- 📊 **Progress tracking** - Built-in progress callbacks for monitoring processing status
- 🔄 **Retry functionality** - Exponential backoff retry utility for resilient operations
- 💪 **TypeScript support** - Full type safety with comprehensive TypeScript definitions
- 🧪 **Well tested** - Comprehensive test suite with high coverage

## Installation

```bash
npm install flexible-batches
```

## Quick Start

```typescript
import { processInBatches, createBatch } from 'flexible-batches';

// Simple batch processing
const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const processor = async (item: number) => item * 2;

const results = await processInBatches(items, processor, {
  batchSize: 3,
  delay: 100, // 100ms delay between batches
});

console.log(results); // [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
```

## API Reference

### `processInBatches<T, R>(items, processor, options?)`

Process an array of items in batches (one-time use).

```typescript
const results = await processInBatches(
  [1, 2, 3, 4, 5],
  async (item) => item * 2,
  {
    batchSize: 2,
    concurrency: 2,
    delay: 100,
  }
);
```

### `createBatch<T, R>(processor, options?)`

Create a reusable batch processor instance.

```typescript
const batchProcessor = createBatch(
  async (item: string) => item.toUpperCase(),
  {
    batchSize: 5,
    concurrency: 3,
    onProgress: (completed, total) => {
      console.log(`Progress: ${completed}/${total}`);
    },
  }
);

const results = await batchProcessor.process(['a', 'b', 'c', 'd', 'e']);
```

### `BatchProcessor` Class

The main class for batch processing operations.

```typescript
import { BatchProcessor } from 'flexible-batches';

const processor = new BatchProcessor(
  async (item: number) => {
    // Your processing logic
    return item * 2;
  },
  {
    batchSize: 10,
    concurrency: 2,
    delay: 50,
    stopOnError: false,
    onProgress: (completed, total) => {
      console.log(`Processed ${completed}/${total} items`);
    },
    onError: (error, item, index) => {
      console.error(`Error processing item ${item} at index ${index}:`, error);
    },
  }
);

const results = await processor.process(items);
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `batchSize` | `number` | `10` | Number of items to process in each batch |
| `delay` | `number` | `0` | Delay in milliseconds between batches |
| `concurrency` | `number` | `1` | Maximum number of concurrent batches |
| `stopOnError` | `boolean` | `false` | Whether to stop processing on first error |
| `onProgress` | `function` | `undefined` | Progress callback `(completed, total) => void` |
| `onError` | `function` | `undefined` | Error callback `(error, item, index) => void` |

## Advanced Examples

### Concurrent Processing with Error Handling

```typescript
import { BatchProcessor } from 'flexible-batches';

const processor = new BatchProcessor(
  async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  },
  {
    batchSize: 5,
    concurrency: 3,
    delay: 100,
    stopOnError: false,
    onProgress: (completed, total) => {
      console.log(`Downloaded ${completed}/${total} URLs`);
    },
    onError: (error, url, index) => {
      console.error(`Failed to download ${url}:`, error.message);
    },
  }
);

const urls = ['https://api1.com', 'https://api2.com', /* ... */];
const results = await processor.process(urls);
```

### File Processing with Progress Tracking

```typescript
import { createBatch } from 'flexible-batches';
import { readFile, writeFile } from 'fs/promises';

const fileProcessor = createBatch(
  async (filePath: string) => {
    const content = await readFile(filePath, 'utf-8');
    const processed = content.toUpperCase();
    const outputPath = filePath.replace('.txt', '.processed.txt');
    await writeFile(outputPath, processed);
    return outputPath;
  },
  {
    batchSize: 10,
    concurrency: 5,
    onProgress: (completed, total) => {
      const percentage = Math.round((completed / total) * 100);
      console.log(`Processing files: ${percentage}% complete`);
    },
  }
);

const filePaths = ['file1.txt', 'file2.txt', /* ... */];
const processedFiles = await fileProcessor.process(filePaths);
```

### Using Retry Utility

```typescript
import { retry, delay } from 'flexible-batches';

const unreliableOperation = async () => {
  // Simulate an operation that might fail
  if (Math.random() < 0.7) {
    throw new Error('Operation failed');
  }
  return 'Success!';
};

try {
  const result = await retry(
    unreliableOperation,
    3, // max attempts
    1000 // base delay (1 second)
  );
  console.log(result);
} catch (error) {
  console.error('Operation failed after 3 attempts');
}
```

### Chunking Utility

```typescript
import { chunk } from 'flexible-batches';

const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const batches = chunk(items, 3);
console.log(batches); // [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]
```

## TypeScript Support

This library is written in TypeScript and provides full type safety:

```typescript
import { BatchProcessor, ProcessorFunction } from 'flexible-batches';

// Type-safe processor function
const processor: ProcessorFunction<string, number> = async (item: string) => {
  return item.length;
};

const batchProcessor = new BatchProcessor(processor, {
  batchSize: 5,
});

// TypeScript ensures type safety
const strings = ['hello', 'world', 'typescript'];
const lengths: number[] = await batchProcessor.process(strings);
```

## Error Handling

The library provides flexible error handling options:

- **Continue on Error** (default): Failed items are filtered out, processing continues
- **Stop on Error**: Processing stops immediately when an error occurs
- **Custom Error Handling**: Use the `onError` callback for custom error handling logic

## Performance Tips

1. **Batch Size**: Larger batches reduce overhead but increase memory usage
2. **Concurrency**: Higher concurrency improves throughput but may overwhelm resources
3. **Delays**: Use delays to respect rate limits or reduce system load
4. **Error Strategy**: Choose the appropriate error handling strategy for your use case

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT License - see LICENSE file for details.
