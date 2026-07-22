import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AdmissionClaims {
  saleId: string;
  queueId: string;
}

/**
 * Only requests carrying a valid admission ticket (issued by QueueService
 * once the waiting room let them through) can reach /checkout. This is
 * what actually enforces the rate limit — the queue is meaningless if
 * checkout is reachable directly.
 */
@Injectable()
export class AdmissionGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing admission ticket — join the queue first.');
    }

    const token = header.slice('Bearer '.length);
    try {
      const claims = await this.jwt.verifyAsync<AdmissionClaims>(token);
      (request as Request & { admission: AdmissionClaims }).admission = claims;
      return true;
    } catch {
      throw new UnauthorizedException('Admission ticket is invalid or expired.');
    }
  }
}
