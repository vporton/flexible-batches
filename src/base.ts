import OpenAI from 'openai';

/// Store (such as a database) for data that may be stored by `FlexibleOpenAI` and
/// read by `FlexibleOpenAIOutput`.
export interface FlexibleStore {
  init(): Promise<void>;
  /// Free database space used by the store.
  clear(): Promise<void>;
}

/// Initiates a series of OpenAI requests.
/// They are later (after the processing is done) read by `FlexibleOpenAIOutput`.
export interface FlexibleOpenAI {
  init(): Promise<void>;

  /// Adds an item to the series of OpenAI requests.
  addItem(item: {
    custom_id: string;
    method?: string;
    body: unknown;
  }): Promise<void>;

  flush(): Promise<void>;
}

/// Reads the results of the OpenAI requests initiated by `FlexibleOpenAI`.
export interface FlexibleOpenAIOutput {
  init(): Promise<void>;

  /// If the result is not yet available, returns `undefined`.
  getOutput(customId: string): Promise<OpenAI.Responses.Response | undefined>;

  /// If the result is not yet available, throws an error.
  getOutputOrThrow(customId: string): Promise<OpenAI.Responses.Response>;
}
