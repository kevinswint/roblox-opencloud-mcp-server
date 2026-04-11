/**
 * Token bucket rate limiter for Roblox Open Cloud.
 *
 * Open Cloud enforces a 500 requests/minute shared ceiling per API key across
 * all endpoints. This limiter refills at 500/60 ≈ 8.33 tokens per second with
 * a capacity of 500 tokens, so short bursts up to the full bucket are allowed
 * while sustained throughput is capped at the real API limit.
 *
 * When utilization exceeds 80%, a warning is written to stderr (debounced to
 * once every 5s) so an operator can tell when the server is about to queue.
 *
 * Callers use `rateLimiter.acquire()` and await it before every outgoing
 * request. Acquire returns immediately if tokens are available, otherwise
 * sleeps until the next token is produced.
 */

const DEFAULT_CAPACITY = 500;
const DEFAULT_REFILL_PER_SEC = 500 / 60; // ≈ 8.333...
const WARN_THRESHOLD = 0.8;
const WARN_DEBOUNCE_MS = 5000;

export interface RateLimiterOptions {
  capacity?: number;
  refillPerSec?: number;
}

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillTs: number;
  private readonly capacity: number;
  private readonly refillPerSec: number;
  private lastWarningTs = 0;

  constructor(opts: RateLimiterOptions = {}) {
    this.capacity = opts.capacity ?? DEFAULT_CAPACITY;
    this.refillPerSec = opts.refillPerSec ?? DEFAULT_REFILL_PER_SEC;
    this.tokens = this.capacity;
    this.lastRefillTs = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefillTs) / 1000;
    if (elapsedSec <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillPerSec);
    this.lastRefillTs = now;
  }

  /**
   * Acquire a token. Blocks until one is available.
   * Emits a stderr warning if post-acquire utilization exceeds 80%.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.maybeWarn();
      return;
    }

    const tokensNeeded = 1 - this.tokens;
    const waitMs = Math.max(10, Math.ceil((tokensNeeded / this.refillPerSec) * 1000));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return this.acquire();
  }

  private maybeWarn(): void {
    const utilization = 1 - this.tokens / this.capacity;
    if (utilization < WARN_THRESHOLD) return;
    const now = Date.now();
    if (now - this.lastWarningTs < WARN_DEBOUNCE_MS) return;
    this.lastWarningTs = now;
    process.stderr.write(
      `[rate-limiter] WARNING: ${Math.round(utilization * 100)}% utilization — ` +
        `${Math.floor(this.tokens)}/${this.capacity} tokens remaining\n`
    );
  }

  /** Current approximate token count (refills are applied on read). */
  get currentTokens(): number {
    this.refill();
    return this.tokens;
  }

  /** Current utilization in [0, 1]. */
  get utilization(): number {
    this.refill();
    return 1 - this.tokens / this.capacity;
  }
}

/**
 * Process-wide singleton. One API key per server process, so one bucket
 * suffices. Tools should `await rateLimiter.acquire()` before each HTTP call.
 */
export const rateLimiter = new TokenBucketRateLimiter();
