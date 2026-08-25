import { OpenAICompatibleProvider } from './openai-compatible.mjs';

export class OpenAIProvider extends OpenAICompatibleProvider {
  static BASE_URL = 'https://api.openai.com/v1';
  static DEFAULT_MODEL = 'gpt-4.1-mini';
  static MAX_TOKENS = 32768;

  // Same conservative estimate DeepSeekProvider uses: Markdown full of
  // identifiers and table syntax tokenizes worse than the ~4 chars/token
  // that English prose averages, and under-promising only ever costs an
  // extra pass through the chunker.
  static CHARS_PER_TOKEN = 3;

  // US dollars per million tokens, from https://platform.openai.com/docs/pricing.
  static PRICE_PER_MILLION = { cached: 0.1, fresh: 0.4, output: 1.6 };

  structuredOutput(schema) {
    return { type: 'json_schema', json_schema: { name: 'translation', schema, strict: true } };
  }

  outputBudget() {
    return OpenAIProvider.MAX_TOKENS * OpenAIProvider.CHARS_PER_TOKEN;
  }
}
