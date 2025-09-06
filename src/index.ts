import openai, { OpenAI, toFile } from 'openai';
import { RequestOptions } from 'openai/internal/request-options';
import { Batch } from 'openai/resources/batches';
import { UploadCreateParams, Uploads } from 'openai/resources/index';

export class FlexibleBatch {
  private uploads: { fileName: string }[] = [];
  private uploadId = 0;
  part = '';

  /// I can't add items one-by-one what good design would require,
  /// because OpenAI misdesigned to provide total `bytes` field before uploading.
  constructor(
    private readonly client: OpenAI,
    bodies: Iterable<UploadCreateParams>,
    private readonly options?: RequestOptions
  ) {
    let bytesInFile = 0;
    let count = 0;
    for (const item of bodies) {
      const line = JSON.stringify(item) + '\n';
      if (bytesInFile + line.length > 1024 * 1024 * 100 || count > 50000) { // 100MB limit, 50000 lines limit
        this.flushFile();
      }
      this.part += line;
      bytesInFile += line.length;
      ++count;
    }
  }

  async flushPart() {
    const upload = await this.client.uploads.parts.create(
      (this.uploadId++).toString(),
      { data: await toFile(Buffer.from(this.part, 'utf-8'), 'data.jsonl') }, // FIXME: Vary filename
      this.options
    );
    // this.uploads.push({ fileSize: jsonl.length, lines: count, batch: upload });
  }
}