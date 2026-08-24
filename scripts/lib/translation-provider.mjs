const RESPONSES_API = 'responses';
const CHAT_API = 'chat';

const PRESETS = {
  deepseek: {
    api: CHAT_API,
    url: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-v4-flash',
    body: {thinking: {type: 'disabled'}},
  },
  openai: {
    api: RESPONSES_API,
    url: 'https://api.openai.com/v1/responses',
    model: 'gpt-5-mini',
    body: {},
  },
  compatible: {
    api: CHAT_API,
    url: null,
    model: null,
    body: {},
  },
};

const DEFAULT_PROVIDER = 'deepseek';
const DEFAULT_MAX_TOKENS = 8192;
const ATTEMPTS = 3;

/**
 * Describes the expected reply for providers that cannot enforce a schema server-side.
 * DeepSeek's JSON mode requires both the literal word "json" and a worked example.
 * @param {object} schema JSON Schema the reply must satisfy.
 * @returns {string} Instruction block appended to the system prompt.
 */
function jsonContract(schema) {
  return [
    '',
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

function stripFences(text) {
  const fenced = text.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1] : text;
}

function buildResponsesRequest({model, instructions, payload, schema, extra}) {
  return {
    model,
    instructions,
    input: JSON.stringify(payload),
    text: {
      format: {type: 'json_schema', name: 'documentation_translation_patch', strict: true, schema},
    },
    ...extra,
  };
}

function buildChatRequest({model, instructions, payload, schema, extra, maxTokens}) {
  return {
    model,
    messages: [
      {role: 'system', content: `${instructions}\n${jsonContract(schema)}`},
      {role: 'user', content: JSON.stringify(payload)},
    ],
    response_format: {type: 'json_object'},
    max_tokens: maxTokens,
    ...extra,
  };
}

function readResponsesReply(body) {
  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  throw new Error(`response contained no output_text (${body.id ?? 'unknown response'})`);
}

function readChatReply(body) {
  const choice = body.choices?.[0];
  const text = choice?.message?.content;
  if (!text) throw new Error(`response contained no message content (finish_reason: ${choice?.finish_reason ?? 'unknown'})`);
  if (choice.finish_reason === 'length') throw new Error('reply was truncated; raise TRANSLATION_MAX_TOKENS');
  return stripFences(text);
}

/**
 * Resolves the translation backend from the environment.
 *
 * TRANSLATION_PROVIDER selects a preset (deepseek | openai | compatible) and each
 * part of it can be overridden individually, so pointing the pipeline at another
 * OpenAI-compatible vendor needs no code change.
 *
 * @param {NodeJS.ProcessEnv} [env] Environment to read the configuration from.
 * @returns {{name: string, model: string, url: string, complete: (request: {instructions: string, payload: object, schema: object}) => Promise<object>}}
 */
export function createTranslationProvider(env = process.env) {
  const name = env.TRANSLATION_PROVIDER || DEFAULT_PROVIDER;
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(`unknown TRANSLATION_PROVIDER "${name}"; expected one of ${Object.keys(PRESETS).join(', ')}`);
  }

  const url = env.TRANSLATION_API_URL || preset.url;
  const model = env.TRANSLATION_MODEL || env.OPENAI_TRANSLATION_MODEL || preset.model;
  const apiKey = env.TRANSLATION_API_KEY || env.OPENAI_API_KEY;
  const maxTokens = Number(env.TRANSLATION_MAX_TOKENS) || DEFAULT_MAX_TOKENS;

  if (!apiKey) throw new Error('neither TRANSLATION_API_KEY nor OPENAI_API_KEY is set');
  if (!url) throw new Error(`provider "${name}" needs TRANSLATION_API_URL to be set`);
  if (!model) throw new Error(`provider "${name}" needs TRANSLATION_MODEL to be set`);

  const isChat = preset.api === CHAT_API;
  const build = isChat ? buildChatRequest : buildResponsesRequest;
  const read = isChat ? readChatReply : readResponsesReply;

  async function complete({instructions, payload, schema}) {
    let lastError;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
          body: JSON.stringify(build({model, instructions, payload, schema, extra: preset.body, maxTokens})),
        });

        const body = await response.json();
        if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body.error ?? body)}`);
        return JSON.parse(read(body));
      } catch (error) {
        lastError = error;
        if (attempt < ATTEMPTS) await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
    }

    throw new Error(`${name} request failed after ${ATTEMPTS} attempts: ${lastError}`);
  }

  return {name, model, url, complete};
}
