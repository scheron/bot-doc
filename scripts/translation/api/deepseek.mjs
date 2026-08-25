import { OpenAICompatibleProvider } from './openai-compatible.mjs';

/**
 * Builds a minimal instance of a JSON schema.
 *
 * Used for the worked example DeepSeek's json_object mode needs alongside
 * the schema itself. Derived instead of hand-written, so the example cannot
 * drift from the schema it accompanies — a hand-written one already has,
 * once.
 *
 * @param {object} schema
 * @returns {*}
 */
function exampleValue(schema) {
  if (schema.type === 'object') {
    const properties = schema.properties ?? {};
    const keys = schema.required ?? Object.keys(properties);
    return Object.fromEntries(keys.map((key) => [key, exampleValue(properties[key] ?? { type: 'string' })]));
  }
  if (schema.type === 'array') return [exampleValue(schema.items ?? { type: 'string' })];
  if (schema.type === 'number' || schema.type === 'integer') return 0;
  if (schema.type === 'boolean') return true;
  return 'example';
}

export class DeepSeekProvider extends OpenAICompatibleProvider {
  static BASE_URL = 'https://api.deepseek.com';
  static DEFAULT_MODEL = 'deepseek-v4-flash';
  static MAX_TOKENS = 8192;

  // Deliberately below the ~4 chars/token that English prose averages: Markdown
  // full of identifiers and table syntax tokenizes worse than prose, and this
  // number only ever under-promises. Underselling the budget costs an extra
  // pass through the chunker; overselling it costs a reply cut off mid-answer.
  static CHARS_PER_TOKEN = 3;

  // US dollars per million tokens, taken from the peak-hours column of
  // https://api-docs.deepseek.com/quick_start/pricing. Off-peak is half of
  // this, so a figure derived from these rates is an upper bound.
  static PRICE_PER_MILLION = { cached: 0.014, fresh: 0.44, output: 1.32 };

  get extraBody() {
    // Thinking is on by default at high effort and does not help translation.
    return { thinking: { type: 'disabled' }, max_tokens: DeepSeekProvider.MAX_TOKENS };
  }

  structuredOutput() {
    return { type: 'json_object' };
  }

  systemPrompt(instructions, schema) {
    return `${instructions}\n\n${this._jsonContract(schema)}`;
  }

  outputBudget() {
    return DeepSeekProvider.MAX_TOKENS * DeepSeekProvider.CHARS_PER_TOKEN;
  }

  /**
   * Reads DeepSeek's usage block, which splits prompt tokens into cache hit
   * and cache miss instead of OpenAI's `prompt_tokens_details.cached_tokens`.
   * @param {object} usage
   * @returns {{promptTokens: number, cachedTokens: number, completionTokens: number}}
   */
  parseUsage(usage) {
    return {
      promptTokens: usage.prompt_tokens ?? 0,
      cachedTokens: usage.prompt_cache_hit_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
    };
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
      JSON.stringify(exampleValue(schema)),
      '```',
    ].join('\n');
  }
}
