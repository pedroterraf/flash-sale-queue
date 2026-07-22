import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';

export interface Lock {
  key: string;
  token: string;
}

/**
 * A single-node Redis distributed lock (SET NX PX + a compare-and-delete
 * release script). This is the classic "lock a critical section across
 * concurrent requests" pattern — deliberately NOT the multi-node Redlock
 * algorithm, since a single Redis instance is enough to demonstrate (and
 * load-test) the pattern honestly. See README for the tradeoff.
 */
@Injectable()
export class DistributedLockService {
  constructor(private readonly redis: RedisService) {}

  async acquire(key: string, ttlMs: number, retries = 20, retryDelayMs = 25): Promise<Lock | null> {
    const token = randomUUID();
    for (let attempt = 0; attempt <= retries; attempt++) {
      const acquired = await this.redis.client.set(key, token, 'PX', ttlMs, 'NX');
      if (acquired === 'OK') {
        return { key, token };
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
    return null;
  }

  async release(lock: Lock): Promise<void> {
    await this.redis.client.releaseLock(lock.key, lock.token);
  }

  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const lock = await this.acquire(key, ttlMs);
    if (!lock) {
      throw new Error(`Could not acquire lock for "${key}" — high contention`);
    }
    try {
      return await fn();
    } finally {
      await this.release(lock);
    }
  }
}
