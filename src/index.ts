import { randomUUID } from 'crypto';
import openai, { OpenAI, toFile } from 'openai';
import { RequestOptions } from 'openai/internal/request-options';
import { Batch, BatchCreateParams } from 'openai/resources/batches';
import { UploadCreateParams, Uploads } from 'openai/resources/index';
import { Response } from 'openai/resources/responses';

export interface FlexibleBatchStore {
  /// Get ID used by FlexibleBatchClearer to erase expired batches.
  /// This function is recommended to be called before `addItem`, to store the ID before any items are added.
  getClearingId(): string;
  storeBatchIdByCustomId(props: { custom_id: string; batchId: string }): void;
  getBatchIdByCustomId(custom_id: string): string | undefined;
}

export interface FlexibleBatchClearer {
  clear(clearingId: string): void;
}

export class FlexibleBatch {
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

  async addItem(item: {
    custom_id: string;
    method?: string;
    url: string;
    body: any;
  }) {
    // I will upload each file as one chunk of 1MB maximum and 50000 lines maximum.
    // This will fit into 200MB limit, 50000 lines limit for files and 64MB limit for parts.
    const line = JSON.stringify({ method: 'POST', ...item }) + '\n';
    if (
      this.part.jsonl.length + line.length >
        (this.flexOptions?.maxChunkSize ?? 1024 * 1024) ||
      this.part.customIds.length > (this.flexOptions?.maxLines ?? 50000)
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
      this.store.storeBatchIdByCustomId({ custom_id, batchId: batch.id });
    }
  }

  async getResult(custom_id: string): Promise<Response | undefined> {
    const batch = await this.client.batches.retrieve(
      this.store.getBatchIdByCustomId(custom_id)! // TODO: Cache it.
    );
    if (batch.status !== 'completed') {
      return undefined;
    }
    return await this.client.responses.retrieve(batch.output_file_id!);
  }
}
