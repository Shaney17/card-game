/** Token bucket đơn giản cho mỗi kết nối realtime. */
export class RateLimiter {
  private tokens: number;
  private last: number;
  constructor(
    private capacity = 20,
    private refillPerSec = 8,
    private now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  take(cost = 1): boolean {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.refillPerSec);
    this.last = t;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}
