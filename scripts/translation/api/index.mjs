import { DeepSeek } from './deepseek.mjs';

const PROVIDERS = { deepseek: DeepSeek };
const DEFAULT_PROVIDER = 'deepseek';

/**
 * Builds the configured backend. Adding a vendor means adding a class here,
 * not branching inside the caller.
 *
 * @param {NodeJS.ProcessEnv} [env] Environment holding the configuration.
 * @returns {import('./base.mjs').TranslationProvider} Ready to use provider.
 */
export function createTranslationProvider(env = process.env) {
  const name = env.TRANSLATION_PROVIDER || DEFAULT_PROVIDER;
  const Provider = PROVIDERS[name];
  if (!Provider) throw new Error(`unknown TRANSLATION_PROVIDER "${name}"; expected ${Object.keys(PROVIDERS).join(' or ')}`);

  const apiKey = env.TRANSLATION_API_KEY || env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('neither TRANSLATION_API_KEY nor OPENAI_API_KEY is set');

  return new Provider({ apiKey, model: env.TRANSLATION_MODEL || undefined });
}
