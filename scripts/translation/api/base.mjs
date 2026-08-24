import OpenAI from 'openai';

/**
 * Shared behaviour of every translation backend.
 *
 * Vendors differ in three small ways only: how they are told to return JSON,
 * what extra body fields they expect, and whether the schema has to be spelled
 * out in the prompt. Subclasses override those and nothing else.
 */
export class TranslationProvider {
  /**
   * @param {{apiKey: string, model: string, baseURL?: string}} options Connection details.
   */
  constructor({ apiKey, model, baseURL }) {
    this.client = new OpenAI({ apiKey, baseURL, maxRetries: 3 });
    this.model = model;
    this.usage = { requests: 0, cachedTokens: 0, freshTokens: 0, completionTokens: 0 };
  }

  /**
   * Price of the recorded usage, when the vendor publishes rates.
   * @returns {number|null} Cost in US dollars, or null when unknown.
   */
  costUsd() {
    return null;
  }

  /** @returns {object} Vendor specific body fields. */
  get extraBody() {
    return {};
  }

  /**
   * @param {object} schema Schema the reply must satisfy.
   * @returns {object} Value for the response_format field.
   */
  responseFormat(schema) {
    throw new Error(`${this.constructor.name} does not define responseFormat`);
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
      response_format: this.responseFormat(schema),
      ...this.extraBody,
    });

    this._record(response.usage);

    const [choice] = response.choices;
    if (choice?.finish_reason === 'length') throw new Error('the reply was cut off before it ended');
    if (!choice?.message?.content) throw new Error(`empty reply (finish_reason: ${choice?.finish_reason ?? 'unknown'})`);

    return JSON.parse(choice.message.content);
  }

  /**
   * Adds one reply's token counts to the running total.
   *
   * Cached prompt tokens are billed far more cheaply than fresh ones, so they
   * are counted apart. A vendor that reports no split is treated as all fresh,
   * which cannot understate the bill.
   *
   * @param {object} [usage] The usage block returned with the reply.
   */
  _record(usage) {
    if (!usage) return;
    const prompt = usage.prompt_tokens ?? 0;
    const cached = usage.prompt_cache_hit_tokens ?? 0;

    this.usage.requests += 1;
    this.usage.cachedTokens += cached;
    this.usage.freshTokens += usage.prompt_cache_miss_tokens ?? prompt - cached;
    this.usage.completionTokens += usage.completion_tokens ?? 0;
  }
}
