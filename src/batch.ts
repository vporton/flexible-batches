import { randomUUID } from 'crypto';
import { OpenAI, toFile } from 'openai';
import { RequestOptions } from 'openai/internal/request-options';

import { FlexibleBatchStore, FlexibleOpenAI } from './types';

/// TODO: Restrict max cache size.
export class FlexibleBatchStoreCache implements FlexibleBatchStore {
  private cache: Map<string, string | undefined> = new Map();
  constructor(private readonly store: FlexibleBatchStore) {}
  getClearingId(): Promise<string> {
    return this.store.getClearingId();
  }
  async storeBatchIdByCustomId(props: {
    customId: string;
    batchId: string;
  }): Promise<void> {
    await this.store.storeBatchIdByCustomId(props);
    this.cache.set(props.customId, props.batchId);
  }
  async getBatchIdByCustomId(customId: string): Promise<string | undefined> {
    const cached = this.cache.get(customId);
    if (cached) {
      return cached;
    }
    const value = await this.store.getBatchIdByCustomId(customId);
    this.cache.set(customId, value);
    return value;
  }
}

export class FlexibleOpenAIBatch implements FlexibleOpenAI {
  private part: { jsonl: string; customIds: string[] } = {
    jsonl: '',
    customIds: [],
  };

  constructor(
    private readonly client: OpenAI,
    private readonly endpoint:
      | '/v1/responses'
      | '/v1/chat/completions'
      | '/v1/embeddings'
      | '/v1/completions',
    private readonly store: FlexibleBatchStore,
    private readonly requestOptions?: RequestOptions,
    private readonly flexOptions?: {
      maxChunkSize?: number; // Increase it, if you need long prompts.
      maxLines?: number; // Decreasing it facilitates flushing more often.
    }
  ) {
    if (this.flexOptions?.maxChunkSize ?? 0 > 64 * 1024 * 1024) {
      throw new Error('maxChunkSize must be less than 64MB');
    }
    if (this.flexOptions?.maxLines ?? 0 > 50000) {
      throw new Error('maxLines must be less than 50000');
    }
  }

  getMaxChunkSize(): number {
    return this.flexOptions?.maxChunkSize ?? 1024 * 1024;
  }

  getMaxLines(): number {
    return this.flexOptions?.maxLines ?? 50000;
  }

  async addItem(item: {
    custom_id: string;
    method?: string;
    url: string;
    body: any;
  }) {
    // I will upload each file as one chunk of 1MB maximum and 50000 lines maximum.
    // This will fit into 200MB limit, 50000 lines limit for files and 64MB limit for parts.
    const line = JSON.stringify({ method: 'POST', ...item }) + '\n';
    if (line.length > this.getMaxChunkSize()) {
      throw new Error(
        `An AI request is too long. It must be less than ${this.getMaxChunkSize()} bytes.`
      );
    }
    if (
      this.part.jsonl.length + line.length > this.getMaxChunkSize() ||
      this.part.customIds.length > this.getMaxLines()
    ) {
      await this.flushOnOverflow();
      this.part = { jsonl: '', customIds: [] };
    }
    this.part.jsonl += line;
    this.part.customIds.push(item.custom_id);
  }

  async flush() {
    if (this.part.jsonl.length != 0) {
      this.flushOnOverflow();
    }
  }

  private async flushOnOverflow() {
    const fileName = randomUUID().toString() + '.jsonl';

    const upload = await this.client.uploads.create({
      purpose: 'batch',
      bytes: this.part.jsonl.length,
      filename: fileName,
      mime_type: 'application/jsonl',
    });

    await this.client.uploads.parts.create(
      fileName + '-0',
      {
        data: await toFile(Buffer.from(this.part.jsonl, 'utf-8'), fileName),
      },
      this.requestOptions
    );

    // TODO: Need to check that file.partIds is not empty?
    await this.client.uploads.complete(fileName, {
      part_ids: [fileName + '-0'], // one part per file
    });

    const batch = await this.client.batches.create({
      input_file_id: upload.id,
      completion_window: '24h',
      endpoint: this.endpoint,
    });

    for (const custom_id of this.part.customIds) {
      await this.store.storeBatchIdByCustomId({
        customId: custom_id,
        batchId: batch.id,
      });
    }
  }

  async getOutput(
    customId: string
  ): Promise<OpenAI.Responses.Response | undefined> {
    const batch = await this.client.batches.retrieve(
      (await this.store.getBatchIdByCustomId(customId))!
    );
    if (batch.status !== 'completed') {
      return undefined;
    }
    return await this.client.responses.retrieve(batch.output_file_id!);
  }

  // TODO: Duplicate code.
  async getOutputOrThrow(customId: string): Promise<OpenAI.Responses.Response> {
    const result = await this.getOutput(customId);
    if (!result) {
      throw new Error(`Output not found for custom_id: ${customId}`);
    }
    return result;
  }
}
