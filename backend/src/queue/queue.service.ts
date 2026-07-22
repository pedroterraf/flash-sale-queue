import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';
import {
  ADMISSION_RATE_PER_SECOND,
  ADMISSION_TICKET_TTL_SECONDS,
  ADMISSION_BUCKET_HISTORY_SECONDS,
} from '../config/constants';
import { ticketKey, tokenBucketKey } from '../config/keys';

const queueKey = (saleId: string) => `queue:${saleId}`;
const admittedCounterKey = (saleId: string) => `admitted:count:${saleId}`;

export type JoinResult = { queueId: string; saleId: string };

export type StatusResult =
  | { status: 'waiting'; position: number; queueDepth: number; estimatedWaitSeconds: number }
  | { status: 'admitted'; ticket: string; expiresInSeconds: number };

@Injectable()
export class QueueService {
  constructor(
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
  ) {}

  async join(saleId: string): Promise<JoinResult> {
    const queueId = randomUUID();
    await this.redis.client.zadd(queueKey(saleId), Date.now(), queueId);
    return { queueId, saleId };
  }

  async getQueueDepth(saleId: string): Promise<number> {
    return this.redis.client.zcard(queueKey(saleId));
  }

  async getAdmittedCount(saleId: string): Promise<number> {
    const value = await this.redis.client.get(admittedCounterKey(saleId));
    return value ? Number(value) : 0;
  }

  /**
   * Called on every status poll from every client. Each call attempts to
   * advance the queue by exactly one slot via an atomic Lua script that
   * checks a per-second token bucket before popping the front of the FIFO
   * ZSET — so no matter how many clients poll concurrently, at most
   * `ADMISSION_RATE_PER_SECOND` admissions can happen in any given second.
   * Whoever gets popped (which may not be the caller!) gets their ticket
   * written to Redis immediately; the caller then checks whether *their*
   * own ticket exists yet.
   */
  async status(saleId: string, queueId: string): Promise<StatusResult> {
    const myExistingTicket = await this.redis.client.get(ticketKey(saleId, queueId));
    if (myExistingTicket) {
      return this.ticketResponse(saleId, queueId, myExistingTicket);
    }

    const unixSecond = Math.floor(Date.now() / 1000);
    const admittedQueueId = await this.redis.client.admitNext(
      queueKey(saleId),
      tokenBucketKey(saleId, unixSecond),
      ADMISSION_RATE_PER_SECOND,
      ADMISSION_BUCKET_HISTORY_SECONDS,
    );

    if (admittedQueueId) {
      const ticket = await this.jwt.signAsync(
        { saleId, queueId: admittedQueueId },
        { expiresIn: ADMISSION_TICKET_TTL_SECONDS },
      );
      await this.redis.client.set(
        ticketKey(saleId, admittedQueueId),
        ticket,
        'EX',
        ADMISSION_TICKET_TTL_SECONDS,
      );
      await this.redis.client.incr(admittedCounterKey(saleId));

      if (admittedQueueId === queueId) {
        return this.ticketResponse(saleId, queueId, ticket);
      }
    }

    // Not popped by this call — either still waiting, or a *different*
    // call (triggered by someone else's poll) already admitted us.
    const myTicketNow = await this.redis.client.get(ticketKey(saleId, queueId));
    if (myTicketNow) {
      return this.ticketResponse(saleId, queueId, myTicketNow);
    }

    const rank = await this.redis.client.zrank(queueKey(saleId), queueId);
    if (rank === null) {
      throw new NotFoundException('Ticket de cola desconocido — unite a la cola primero.');
    }

    const queueDepth = await this.getQueueDepth(saleId);
    return {
      status: 'waiting',
      position: rank + 1,
      queueDepth,
      estimatedWaitSeconds: rank / ADMISSION_RATE_PER_SECOND,
    };
  }

  private async ticketResponse(saleId: string, queueId: string, ticket: string): Promise<StatusResult> {
    const ttl = await this.redis.client.ttl(ticketKey(saleId, queueId));
    return { status: 'admitted', ticket, expiresInSeconds: Math.max(ttl, 0) };
  }
}
