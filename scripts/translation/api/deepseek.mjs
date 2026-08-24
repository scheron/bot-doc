import { TranslationProvider } from './base.mjs';

export class DeepSeek extends TranslationProvider {
  static BASE_URL = 'https://api.deepseek.com';
  static DEFAULT_MODEL = 'deepseek-v4-flash';
  static MAX_TOKENS = 8192;

  // US dollars per million tokens, taken from the peak-hours column of
  // https://api-docs.deepseek.com/quick_start/pricing. Off-peak is half of
  // this, so a figure derived from these rates is an upper bound.
  static PRICE_PER_MILLION = { cached: 0.014, fresh: 0.44, output: 1.32 };

  constructor({ apiKey, model = DeepSeek.DEFAULT_MODEL }) {
    super({ apiKey, model, baseURL: DeepSeek.BASE_URL });
  }

  get extraBody() {
    // Thinking is on by default at high effort and does not help translation.
    return { thinking: { type: 'disabled' }, max_tokens: DeepSeek.MAX_TOKENS };
  }

  responseFormat() {
    return { type: 'json_object' };
  }

  costUsd() {
    const { cached, fresh, output } = DeepSeek.PRICE_PER_MILLION;
    const total =
      (this.usage.cachedTokens * cached + this.usage.freshTokens * fresh + this.usage.completionTokens * output) /
      1_000_000;
    return Math.round(total * 10_000) / 10_000;
  }

  systemPrompt(instructions, schema) {
    return `${instructions}\n\n${this._jsonContract(schema)}`;
  }

  /**
   * Describes the reply shape in words.
   *
   * DeepSeek accepts only `text` or `json_object` in response_format, so the
   * schema cannot be enforced by the API. Its JSON mode also needs the literal
   * word "json" and a worked example to behave.
   *
   * @param {object} schema Schema the reply must satisfy.
   * @returns {string} Instruction block appended to the system prompt.
   */
  _jsonContract(schema) {
    return [
      '# JSON output contract',
      '',
      'Reply with a single json object and nothing else: no Markdown fences, no commentary.',
      'The json must validate against this schema:',
      '',
      '```json',
      JSON.stringify(schema, null, 2),
      '```',
      '',
      'Example of the expected json shape:',
      '',
      '```json',
      '{"full_translation": "# Title\\n\\nThe complete English document.", "operations": [{"find": "exact existing English text", "replace": "its replacement"}]}',
      '```',
    ].join('\n');
  }
}
