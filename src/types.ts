import OpenAI from 'openai';

export interface FlexibleBatchStore {
  /// Get ID used by FlexibleBatchClearer to erase expired batches.
  /// This function is recommended to be called before `addItem`, to store the ID before any items are added.
  getClearingId(): Promise<string>;
  storeBatchIdByCustomId(props: {
    customId: string;
    batchId: string;
  }): Promise<void>;
  getBatchIdByCustomId(customId: string): Promise<string | undefined>;
}

export interface FlexibleBatchClearer {
  clear(clearingId: string): void;
}

export interface FlexibleOpenAI {
  addItem(item: {
    custom_id: string;
    method?: string;
    url: string;
    body: any;
  }): Promise<void>;

  flush(): Promise<void>;

  getOutput(customId: string): Promise<OpenAI.Responses.Response | undefined>;

  getOutputOrThrow(customId: string): Promise<OpenAI.Responses.Response>;
}
