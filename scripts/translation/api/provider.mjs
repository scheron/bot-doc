/**
 * Behaviour shared by every translation backend, independent of vendor
 * protocol.
 *
 * A vendor differs in wire format only — how it is told to return JSON, what
 * extra body fields it expects, and how its usage block reads. Everything
 * here — the public contract, usage accounting, and pricing by the rates the
 * implementation declares — does not, and nothing here names an SDK.
 */
export class TranslationProvider {
  constructor() {
    this.usage = { requests: 0, cachedTokens: 0, promptTokens: 0, completionTokens: 0 };
  }

  /**
   * Asks the model for one translation.
   * @param {{instructions: string, payload: object, schema: object}} request What to translate.
   * @returns {Promise<object>} The decoded reply.
   */
  async translate(request) {
    throw new Error(`${this.constructor.name} does not implement translate`);
  }

  /**
   * @returns {{model: string, requests: number, promptTokens: number,
   *            cachedTokens: number, completionTokens: number,
   *            costUsd: number|null, summary: string}}
   */
  usageReport() {
    const { requests, cachedTokens, promptTokens, completionTokens } = this.usage;
    const costUsd = this._priceUsage();
    const price = costUsd === null ? '' : `, $${costUsd.toFixed(4)}`;
    const summary =
      `${requests} request(s), ${promptTokens} prompt tokens (${cachedTokens} cached), ` +
      `${completionTokens} completion tokens${price}`;
    return { model: this.model, requests, promptTokens, cachedTokens, completionTokens, costUsd, summary };
  }

  /** @returns {number} Characters of Markdown returnable in one reply. */
  outputBudget() {
    throw new Error(`${this.constructor.name} does not define outputBudget`);
  }

  /**
   * Prices the recorded usage against `PRICE_PER_MILLION`, a static the
   * implementing class declares. A class that declares none is priced as
   * unknown, never as free.
   * @returns {number|null} Cost in US dollars, or null when the class
   *   declares no rates.
   */
  _priceUsage() {
    const rates = this.constructor.PRICE_PER_MILLION;
    if (!rates) return null;

    const { cachedTokens, promptTokens, completionTokens } = this.usage;
    const freshTokens = promptTokens - cachedTokens;
    const total =
      (cachedTokens * rates.cached + freshTokens * rates.fresh + completionTokens * rates.output) / 1_000_000;
    return Math.round(total * 10_000) / 10_000;
  }

  /**
   * Adds one reply's usage to the running total. The vendor-specific shape of
   * `usage` is read by {@link parseUsage}, which the implementation overrides.
   * @param {object} [usage] The usage block returned with the reply.
   */
  _record(usage) {
    if (!usage) return;
    const parsed = this.parseUsage(usage);

    this.usage.requests += 1;
    this.usage.cachedTokens += parsed.cachedTokens;
    this.usage.promptTokens += parsed.promptTokens;
    this.usage.completionTokens += parsed.completionTokens;
  }

  /**
   * Reads one reply's usage block in the vendor's own shape.
   * @param {object} usage
   * @returns {{promptTokens: number, cachedTokens: number, completionTokens: number}}
   */
  parseUsage(usage) {
    throw new Error(`${this.constructor.name} does not implement parseUsage`);
  }
}
