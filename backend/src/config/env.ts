/**
 * Environment configuration
 *
 * Provides typed access to environment variables with defaults.
 */

export const env = {
  // Database
  get databaseUrl(): string | undefined {
    return process.env.DATABASE_URL || process.env.POSTGRES_URL;
  },

  // JWT
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET must be set');
    }
    return secret;
  },

  // CORS
  get corsOrigin(): string {
    return process.env.CORS_ORIGIN || 'http://localhost:5173';
  },

  // Server
  get port(): number {
    return parseInt(process.env.PORT || '8080', 10);
  },

  // AI Provider
  get openaiApiKey(): string | undefined {
    return process.env.OPENAI_API_KEY;
  },
  get openaiBaseUrl(): string | undefined {
    return process.env.OPENAI_BASE_URL;
  },
  get openaiModel(): string {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  },

  // Rate limiting
  get authRateLimitMax(): number {
    return process.env.AUTH_RATE_LIMIT_MAX
      ? parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10)
      : 10;
  },

  // Simulation
  get maxShots(): number {
    return process.env.MAX_SHOTS
      ? parseInt(process.env.MAX_SHOTS, 10)
      : 10000;
  },

  // Environment
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },
  get isProduction(): boolean {
    return env.nodeEnv === 'production';
  },
  get isTest(): boolean {
    return env.nodeEnv === 'test';
  },
};