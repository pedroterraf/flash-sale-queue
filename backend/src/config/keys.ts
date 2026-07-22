/** Redis key names shared across modules — kept in one place to avoid drift. */
export const ticketKey = (saleId: string, queueId: string) => `ticket:${saleId}:${queueId}`;
export const tokenBucketKey = (saleId: string, unixSecond: number) => `admission:tokens:${saleId}:${unixSecond}`;
