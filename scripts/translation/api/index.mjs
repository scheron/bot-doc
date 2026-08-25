import { TranslationError } from '../translate-docs.mjs';
import { DeepSeekProvider } from './deepseek.mjs';
import { OpenAIProvider } from './openai.mjs';

const PROVIDERS = { deepseek: DeepSeekProvider, openai: OpenAIProvider };
const DEFAULT_PROVIDER = 'deepseek';

/**
 * Builds one provider from a vendor name and a model. Adding a vendor means
 * adding a class here, not branching inside a caller.
 *
 * @param {NodeJS.ProcessEnv} env Environment holding the configuration.
 * @param {string|undefined} providerName Vendor name for this role, already
 *   resolved with whatever fallback the role needs.
 * @param {string|undefined} model Model for this role, same fallback rule.
 * @returns {import('./provider.mjs').TranslationProvider} Ready to use provider.
 */
function buildProvider(env, providerName, model) {
  const name = providerName || DEFAULT_PROVIDER;
  const Provider = PROVIDERS[name];
  if (!Provider) throw new TranslationError(`unknown provider "${name}"; expected ${Object.keys(PROVIDERS).join(' or ')}`);

  // One key for every role and every vendor: the vendor is OpenAI-compatible,
  // not OpenAI the company, so there is nothing role-specific to name it after.
  const apiKey = env.TRANSLATION_API_KEY;
  if (!apiKey) throw new TranslationError('TRANSLATION_API_KEY is not set');

  return new Provider({ apiKey, model: model || undefined });
}

/**
 * Builds the backend used to translate documents.
 *
 * @param {NodeJS.ProcessEnv} [env] Environment holding the configuration.
 * @returns {import('./provider.mjs').TranslationProvider} Ready to use provider.
 */
export function createTranslationProvider(env = process.env) {
  return buildProvider(env, env.TRANSLATION_PROVIDER, env.TRANSLATION_MODEL);
}

/**
 * Builds the backend used to classify glossary candidates. Falls back to the
 * translation role's own vendor and model when the glossary role has none of
 * its own, so term mining works in an environment that has not been told
 * about it yet.
 *
 * @param {NodeJS.ProcessEnv} [env] Environment holding the configuration.
 * @returns {import('./provider.mjs').TranslationProvider} Ready to use provider.
 */
export function createGlossaryProvider(env = process.env) {
  return buildProvider(env, env.GLOSSARY_PROVIDER || env.TRANSLATION_PROVIDER, env.GLOSSARY_MODEL || env.TRANSLATION_MODEL);
}
