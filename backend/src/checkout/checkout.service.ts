import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { DistributedLockService } from './distributed-lock.service';
import { InventoryService } from '../inventory/inventory.service';
import { RedisService } from '../redis/redis.service';
import { CHECKOUT_LOCK_TTL_MS } from '../config/constants';
import { ticketKey } from '../config/keys';

export type CheckoutResult =
  | { status: 'purchased'; unitNumber: number; reservationId: string }
  | { status: 'sold_out' };

export type BreakerState = 'closed' | 'open' | 'half-open';

@Injectable()
export class CheckoutService {
  /**
   * Wraps the simulated downstream call, not the Redis lock/decrement.
   * Fail-closed: once the breaker opens, we stop calling the struggling
   * dependency entirely for `resetTimeout` ms and reject fast instead of
   * piling up timeouts on top of an already-unhealthy system.
   */
  private readonly breaker: CircuitBreaker<[saleId: string], { reservationId: string }>;

  constructor(
    private readonly lock: DistributedLockService,
    private readonly inventory: InventoryService,
    private readonly redis: RedisService,
  ) {
    this.breaker = new CircuitBreaker((saleId: string) => this.inventory.reserveUnit(saleId), {
      timeout: 800,
      errorThresholdPercentage: 50,
      resetTimeout: 5000,
      rollingCountBuckets: 10,
      rollingCountTimeout: 10000,
      volumeThreshold: 5,
    });
    this.breaker.fallback(() => {
      throw new ServiceUnavailableException(
        'High demand — checkout is temporarily paused to protect the system. Try again shortly.',
      );
    });
  }

  getBreakerState(): BreakerState {
    if (this.breaker.opened) return 'open';
    if (this.breaker.halfOpen) return 'half-open';
    return 'closed';
  }

  getBreakerStats() {
    return {
      state: this.getBreakerState(),
      ...this.breaker.stats,
    };
  }

  /**
   * `queueId` is only used to burn the admission ticket once this attempt
   * reaches a *definitive* outcome — purchased or genuinely sold out. A
   * transient failure (breaker open, lock contention) leaves the ticket
   * alone so the client can retry with the same ticket; it must never be
   * possible to reuse a ticket to buy a second unit, though (see
   * AdmissionGuard — this is the other half of that fix).
   */
  async purchase(saleId: string, queueId: string): Promise<CheckoutResult> {
    const result = await this.lock.withLock(`lock:sale:${saleId}`, CHECKOUT_LOCK_TTL_MS, async () => {
      const stock = await this.inventory.getStock(saleId);
      if (stock <= 0) {
        return { status: 'sold_out' as const };
      }

      // Downstream call goes through the breaker — this is the part that
      // can fail/slow down and is what the /admin/chaos toggle simulates.
      const reservation = await this.breaker.fire(saleId);
      const unitNumber = await this.inventory.decrementStock(saleId);

      return { status: 'purchased' as const, unitNumber, reservationId: reservation.reservationId };
    });

    await this.redis.client.del(ticketKey(saleId, queueId));
    return result;
  }
}
