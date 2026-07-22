import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const STOCK_KEY = (saleId: string) => `stock:${saleId}`;
const SOLD_KEY = (saleId: string) => `sold:${saleId}`;
const CHAOS_KEY = 'chaos:enabled';

/**
 * Stands in for a downstream dependency the real checkout would call
 * (payment authorization, a fulfillment/ERP system, etc.) — something
 * with real network latency and a real failure mode. `chaos mode` lets the
 * demo flip it into "outage" so you can watch the circuit breaker open.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly redis: RedisService) {}

  async ensureInitialized(saleId: string, totalStock: number): Promise<void> {
    await this.redis.client.set(STOCK_KEY(saleId), totalStock, 'NX');
    await this.redis.client.set(SOLD_KEY(saleId), 0, 'NX');
  }

  async getStock(saleId: string): Promise<number> {
    const value = await this.redis.client.get(STOCK_KEY(saleId));
    return value ? Number(value) : 0;
  }

  async getSoldCount(saleId: string): Promise<number> {
    const value = await this.redis.client.get(SOLD_KEY(saleId));
    return value ? Number(value) : 0;
  }

  async isChaosEnabled(): Promise<boolean> {
    return (await this.redis.client.get(CHAOS_KEY)) === '1';
  }

  async setChaos(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.redis.client.set(CHAOS_KEY, '1');
    } else {
      await this.redis.client.del(CHAOS_KEY);
    }
  }

  /**
   * Simulated call to the downstream system. This is the function the
   * circuit breaker wraps in CheckoutService — NOT the Redis stock
   * decrement itself, which stays fast and local under the lock.
   */
  async reserveUnit(saleId: string): Promise<{ reservationId: string }> {
    const latencyMs = 30 + Math.random() * 70;
    await new Promise((resolve) => setTimeout(resolve, latencyMs));

    if (await this.isChaosEnabled()) {
      throw new Error('downstream fulfillment service unavailable (chaos mode)');
    }

    return { reservationId: `${saleId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  }

  /**
   * Atomic decrement, only ever called while holding the sale's lock.
   * Returns the unit's sequence number (1-indexed) for the confirmation.
   */
  async decrementStock(saleId: string): Promise<number> {
    await this.redis.client.decr(STOCK_KEY(saleId));
    return this.redis.client.incr(SOLD_KEY(saleId));
  }
}
