import OpenAI from 'openai';

export interface FlexibleOpenAI {
  init(): Promise<void>;

  addItem(item: {
    custom_id: string;
    method?: string;
    body: unknown;
  }): Promise<void>;

  flush(): Promise<void>;
}

export interface FlexibleOpenAIOutput {
  init(): Promise<void>;

  getOutput(customId: string): Promise<OpenAI.Responses.Response | undefined>;

  getOutputOrThrow(customId: string): Promise<OpenAI.Responses.Response>;
}
