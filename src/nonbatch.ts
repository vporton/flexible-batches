import OpenAI from 'openai';
import { FlexibleOpenAI } from './base';
import { RequestOptions } from 'openai/internal/request-options';

export interface FlexibleNonBatchStore {
  /// Get ID used by FlexibleBatchClearer to erase expired batches.
  /// This function is recommended to be called before `addItem`, to store the ID before any items are added.
  getClearingId(): Promise<string>;
  storeResponseByCustomId(props: {
    customId: string;
    response: OpenAI.Responses.Response;
  }): Promise<void>;
  getResponseByCustomId(
    customId: string
  ): Promise<OpenAI.Responses.Response | undefined>;
}

export interface FlexibleNonBatchClearer {
  clear(clearingId: string): void;
}

export class FlexibleOpenAINonBatch implements FlexibleOpenAI {
  constructor(
    private readonly client: OpenAI,
    private readonly endpoint:
      | '/v1/responses'
      | '/v1/chat/completions'
      | '/v1/embeddings'
      | '/v1/completions',
    private readonly store: FlexibleNonBatchStore,
    private readonly requestOptions?: RequestOptions
  ) {}

  async addItem(item: {
    custom_id: string;
    method?: string;
    body: unknown; // TODO: Use `unknown` type?
  }) {
    const response = await this.client.post(this.endpoint, {
      ...this.requestOptions,
      method: 'post',
      path: this.endpoint,
      body: item.body,
    });
    this.store.storeResponseByCustomId({
      customId: item.custom_id,
      response: response as OpenAI.Responses.Response,
    });
  }

  async flush() {}

  async getOutput(
    customId: string
  ): Promise<OpenAI.Responses.Response | undefined> {
    return await this.store.getResponseByCustomId(customId);
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
