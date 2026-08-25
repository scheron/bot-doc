import OpenAI from 'openai';

import { TranslationProvider } from './provider.mjs';

/**
 * Shared behaviour of every backend that speaks OpenAI's chat-completions
 * wire format, whether the vendor is OpenAI itself or one of its compatible
 * peers.
 *
 * Vendors differ in three small ways only: how they are told to return JSON,
 * what extra body fields they expect, and how their usage block reads.
 * Subclasses override those and nothing else.
 */
export class OpenAICompatibleProvider extends TranslationProvider {
  /**
   * @param {{apiKey: string, model?: string}} options Connection details.
   */
  constructor({ apiKey, model }) {
    super();
    const { BASE_URL, DEFAULT_MODEL } = this.constructor;
    this.client = new OpenAI({ apiKey, baseURL: BASE_URL, maxRetries: 3 });
    this.model = model || DEFAULT_MODEL;
  }

  /**
   * @param {object} schema Schema the reply must satisfy.
   * @returns {object} Value for the response_format field.
   */
  structuredOutput(schema) {
    throw new Error(`${this.constructor.name} does not define structuredOutput`);
  }

  /** @returns {object} Vendor specific body fields. */
  get extraBody() {
    return {};
  }

  /**
   * @param {string} instructions Prompt shared by every provider.
   * @param {object} schema Schema the reply must satisfy.
   * @returns {string} System prompt for this vendor.
   */
  systemPrompt(instructions, schema) {
    return instructions;
  }

  /**
   * Reads one reply's usage block in OpenAI's own shape. Overridden by a
   * vendor whose usage block uses different field names.
   * @param {object} usage
   * @returns {{promptTokens: number, cachedTokens: number, completionTokens: number}}
   */
  parseUsage(usage) {
    return {
      promptTokens: usage.prompt_tokens ?? 0,
      cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
    };
  }

  /**
   * Asks the model for one translation.
   * @param {{instructions: string, payload: object, schema: object}} request What to translate.
   * @returns {Promise<object>} Decoded reply.
   */
  async translate({ instructions, payload, schema }) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: this.systemPrompt(instructions, schema) },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      response_format: this.structuredOutput(schema),
      ...this.extraBody,
    });

    this._record(response.usage);

    const [choice] = response.choices;
    if (choice?.finish_reason === 'length') throw new Error('the reply was cut off before it ended');
    if (!choice?.message?.content) throw new Error(`empty reply (finish_reason: ${choice?.finish_reason ?? 'unknown'})`);

    return JSON.parse(choice.message.content);
  }
}
