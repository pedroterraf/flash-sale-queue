export const DEFAULT_SALE_ID = 'DROP-001';
export const TOTAL_STOCK = Number(process.env.TOTAL_STOCK ?? 300);
export const ADMISSION_RATE_PER_SECOND = Number(process.env.ADMISSION_RATE_PER_SECOND ?? 8);
export const ADMISSION_TICKET_TTL_SECONDS = Number(process.env.ADMISSION_TICKET_TTL_SECONDS ?? 120);
export const CHECKOUT_LOCK_TTL_MS = Number(process.env.CHECKOUT_LOCK_TTL_MS ?? 3000);
export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
