import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { RedisService } from '../redis/redis.service';
import { ticketKey } from '../config/keys';

export interface AdmissionClaims {
  saleId: string;
  queueId: string;
}

/**
 * Only requests carrying a valid, *still-live* admission ticket can reach
 * /checkout. A valid JWT signature alone isn't enough — the ticket also has
 * to still exist in Redis. CheckoutService deletes it the moment a purchase
 * attempt resolves (bought or sold out), so the same ticket can't be replayed
 * to buy a second unit within its TTL window. Without this check the JWT
 * would be reusable for as long as it hasn't expired — a real bug the
 * verification pass here caught (see README).
 */
@Injectable()
export class AdmissionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing admission ticket — join the queue first.');
    }

    const token = header.slice('Bearer '.length);
    let claims: AdmissionClaims;
    try {
      claims = await this.jwt.verifyAsync<AdmissionClaims>(token);
    } catch {
      throw new UnauthorizedException('Admission ticket is invalid or expired.');
    }

    const stillLive = await this.redis.client.get(ticketKey(claims.saleId, claims.queueId));
    if (stillLive !== token) {
      throw new UnauthorizedException('Admission ticket was already used.');
    }

    (request as Request & { admission: AdmissionClaims }).admission = claims;
    return true;
  }
}
