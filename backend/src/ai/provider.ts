import { OpenAI } from 'openai';

/**
 * Chat message exchanged with an AI provider.
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * A single completion choice returned by a provider.
 */
export interface AiChoice {
  index: number;
  message: { role: 'assistant'; content: string };
  finish_reason: string | null;
}

/**
 * Normalized result returned by every provider implementation.
 */
export interface AiCompletionResult {
  choices: AiChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
  provider: string;
}

/**
 * Common interface every AI provider must implement.
 *
 * Providers live server-side only. API keys must never be forwarded to the
 * frontend — the frontend sends a chat request to `/api/ai/chat` and the
 * backend delegates to the configured provider.
 */
export interface AiProvider {
  /** Human-readable name, e.g. "OpenAI" or "OpenRouter". */
  readonly name: string;
  /** The model identifier this provider was instantiated with. */
  readonly model: string;

  /**
   * Send a chat conversation to the provider and return the normalized result.
   * Should throw on network or auth errors; the caller decides fallback.
   */
  chat(messages: ChatMessage[], options?: { temperature?: number; max_tokens?: number }): Promise<AiCompletionResult>;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider (OpenAI, Azure, Groq, Together, vLLM, Ollama, …)
// ---------------------------------------------------------------------------

export interface OpenAiCompatibleConfig {
  apiKey: string;
  baseUrl?: string;       // omit for production OpenAI, set for proxies / other hosts
  model: string;
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = 'OpenAI-compatible';
  readonly model: string;
  private client: OpenAI;

  constructor(config: OpenAiCompatibleConfig) {
    this.model = config.model;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: 30_000,
      maxRetries: 2,
    });
  }

  async chat(
    messages: ChatMessage[],
    options: { temperature?: number; max_tokens?: number } = {},
  ): Promise<AiCompletionResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      ...(options.max_tokens ? { max_tokens: options.max_tokens } : {}),
    });

    const choices: AiChoice[] = response.choices.map((choice, index) => ({
      index,
      message: {
        role: 'assistant',
        content: choice.message.content ?? '',
      },
      finish_reason: choice.finish_reason ?? null,
    }));

    return {
      choices,
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
          }
        : undefined,
      model: response.model,
      provider: this.name,
    };
  }
}

// ---------------------------------------------------------------------------
// Anthropic provider (Claude)
// ---------------------------------------------------------------------------

export interface AnthropicConfig {
  apiKey: string;
  model: string;
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'Anthropic';
  readonly model: string;
  private client: any; // Anthropic SDK
  private apiKey: string;

  constructor(config: AnthropicConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    // Lazy-load the Anthropic SDK so it's only needed when this provider is used
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey: config.apiKey });
    } catch {
      this.client = null;
    }
  }

  async chat(
    messages: ChatMessage[],
    options: { temperature?: number; max_tokens?: number } = {},
  ): Promise<AiCompletionResult> {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // Use the native SDK if available, otherwise fall back to fetch
    if (this.client) {
      const response = await this.client.messages.create({
        model: this.model,
        system: systemMsg?.content,
        messages: nonSystemMessages.map(m => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 4000,
      });

      return {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: response.content[0]?.text ?? '',
            },
            finish_reason: response.stop_reason ?? null,
          },
        ],
        usage: response.usage
          ? {
              prompt_tokens: response.usage.input_tokens,
              completion_tokens: response.usage.output_tokens,
              total_tokens: response.usage.input_tokens + response.usage.output_tokens,
            }
          : undefined,
        model: response.model,
        provider: this.name,
      };
    }

    // Fallback: use the Anthropic-compatible REST API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        system: systemMsg?.content,
        messages: nonSystemMessages.map(m => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return {
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: data.content?.[0]?.text ?? '',
          },
          finish_reason: data.stop_reason ?? null,
        },
      ],
      model: data.model,
      provider: this.name,
    };
  }
}

// ---------------------------------------------------------------------------
// Stub provider — always returns the same response (for development / no key)
// ---------------------------------------------------------------------------

export class StubProvider implements AiProvider {
  readonly name = 'Stub';
  readonly model = 'stub';

  async chat(
    _messages: ChatMessage[],
    _options?: { temperature?: number; max_tokens?: number },
  ): Promise<AiCompletionResult> {
    return {
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `Thanks for your question about quantum computing! I'd be happy to help you understand this better.

In quantum computing, the concepts can be tricky to grasp at first. Let me break this down for you:

- **Superposition** allows qubits to exist in multiple states simultaneously
- **Entanglement** creates correlations between qubits that enable quantum speedup
- **Interference** is used to amplify correct answers and cancel out wrong ones

What specific aspect would you like me to explain further?`,
          },
          finish_reason: 'stop',
        },
      ],
      model: 'stub',
      provider: this.name,
    };
  }
}

// ---------------------------------------------------------------------------
// Provider factory — reads environment variables to pick the right provider
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  type: 'openai' | 'anthropic' | 'stub';
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export function createProvider(config: ProviderConfig): AiProvider {
  switch (config.type) {
    case 'openai':
      if (!config.apiKey) {
        throw new Error('OPENAI_API_KEY is required for the OpenAI provider');
      }
      return new OpenAiCompatibleProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });

    case 'anthropic':
      if (!config.apiKey) {
        throw new Error('ANTHROPIC_API_KEY is required for the Anthropic provider');
      }
      return new AnthropicProvider({
        apiKey: config.apiKey,
        model: config.model,
      });

    default:
      return new StubProvider();
  }
}

/**
 * Resolve the active provider from environment variables.
 *
 * Priority: OPENAI_API_KEY → ANTHROPIC_API_KEY → stub.
 * This keeps the backend flexible — just set the right env var and the
 * tutor automatically uses that provider.
 */
export function resolveProvider(): AiProvider {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (openaiKey) {
    return createProvider({
      type: 'openai',
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL,
    });
  }

  if (anthropicKey) {
    return createProvider({
      type: 'anthropic',
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL ?? 'claude-3-haiku-20240307',
    });
  }

  if (openrouterKey) {
    return createProvider({
      type: 'openai',
      apiKey: openrouterKey,
      model: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-lite',
      baseUrl: 'https://openrouter.ai/api/v1',
    });
  }

  return new StubProvider();
}
