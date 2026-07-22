import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Thin wrapper around a single ioredis connection, shared across the app.
 * Also owns the Lua scripts that need to run atomically on the Redis side
 * (a lock release must never blindly DEL a key it doesn't own anymore).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new Redis(url, { maxRetriesPerRequest: 2 });

    this.client.defineCommand('releaseLock', {
      numberOfKeys: 1,
      lua: `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `,
    });

    // Atomically pop the front of the FIFO queue, but only if this second's
    // admission budget isn't spent yet. This is what makes the rate limit a
    // hard cap on *admission events* rather than a cumulative formula that
    // can burst-admit a backlog once enough polls finally land — a real bug
    // the load test caught (see README "What the load test caught").
    this.client.defineCommand('admitNext', {
      numberOfKeys: 2,
      lua: `
        local used = tonumber(redis.call("GET", KEYS[2]) or "0")
        local rate = tonumber(ARGV[1])
        if used >= rate then
          return nil
        end

        local popped = redis.call("ZRANGE", KEYS[1], 0, 0)
        if #popped == 0 then
          return nil
        end

        redis.call("ZREM", KEYS[1], popped[1])
        redis.call("INCR", KEYS[2])
        redis.call("EXPIRE", KEYS[2], ARGV[2])
        return popped[1]
      `,
    });
  }

  /** True if Redis answered a PING within the timeout — used to fail closed. */
  async isHealthy(timeoutMs = 300): Promise<boolean> {
    try {
      const result = await Promise.race([
        this.client.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('redis ping timeout')), timeoutMs),
        ),
      ]);
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}

// Augment ioredis with the custom commands we defined above.
declare module 'ioredis' {
  interface RedisCommander<Context> {
    releaseLock(key: string, token: string): Promise<number>;
    admitNext(queueKey: string, bucketKey: string, rate: number, bucketTtlSeconds: number): Promise<string | null>;
  }
}
