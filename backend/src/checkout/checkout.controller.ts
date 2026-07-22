import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CheckoutService } from './checkout.service';
import { AdmissionGuard, AdmissionClaims } from './admission.guard';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @UseGuards(AdmissionGuard)
  purchase(@Req() request: Request & { admission: AdmissionClaims }) {
    return this.checkoutService.purchase(request.admission.saleId);
  }
}
