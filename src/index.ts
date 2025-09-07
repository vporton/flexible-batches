import { randomUUID } from 'crypto';
import openai, { OpenAI, toFile } from 'openai';
import { RequestOptions } from 'openai/internal/request-options';
import { Batch, BatchCreateParams } from 'openai/resources/batches';
import { UploadCreateParams, Uploads } from 'openai/resources/index';
import { Response } from 'openai/resources/responses';

export interface FlexibleBatchStore {
  store(custom_id: string, batchId: string): void; // FIXME: Call it.
  getBatchIdByCustomId(custom_id: string): string | undefined;
  // TODO: clearing the cache
}

export class FlexibleBatch {
  private files: { fileName: string; partIds: string[] }[] = [];
  private uploadId = 0;
  private part: { jsonl: string; customIds: string[] } = {
    jsonl: '',
    customIds: [],
  };

  /// I can't add items one-by-one what good design would require,
  /// because OpenAI misdesigned to provide total `bytes` field before uploading.
  constructor(
    private readonly client: OpenAI,
    // bodies: Iterable<UploadCreateParams>,
    bodies: Iterable<{
      custom_id: string;
      method?: string;
      url: string;
      body: any;
    }>,
    private readonly endpoint:
      | '/v1/responses'
      | '/v1/chat/completions'
      | '/v1/embeddings'
      | '/v1/completions',
    private readonly store: FlexibleBatchStore,
    private readonly options?: RequestOptions
  ) {
    // I will upload each file as one chunk of 1MB maximum and 50000 lines maximum.
    // This will fit into 200MB limit, 50000 lines limit for files and 64MB limit for parts.
    let linesInFile = 0;
    for (const item of bodies) {
      const line = JSON.stringify({ method: 'POST', ...item }) + '\n';
      if (
        this.part.jsonl.length + line.length > 1024 * 1024 ||
        linesInFile > 50000
      ) {
        this.flushOnOverflow();
      }
      this.part.jsonl += line;
      this.part.customIds.push(item.custom_id);
      ++linesInFile;
    }
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
        data: await toFile(Buffer.from(this.part, 'utf-8'), fileName),
      },
      this.options
    );
    // file.partIds.push(upload.id);

    // TODO: Need to check that file.partIds is not empty?
    await this.client.uploads.complete(fileName, {
      part_ids: [fileName + '-0'], // one part per file
    });

    const batch = await this.client.batches.create({
      input_file_id: upload.id,
      completion_window: '24h',
      endpoint: this.endpoint,
      // TODO
    });

    // this.files.push({
    //   fileName,
    //   partIds: [upload.id], // one part per file
    // });
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