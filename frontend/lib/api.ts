const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Stats {
  saleId: string;
  queueDepth: number;
  admittedCount: number;
  stock: number;
  soldCount: number;
  totalStock: number;
  admissionRatePerSecond: number;
  chaosEnabled: boolean;
  redisHealthy: boolean;
  breaker: {
    state: 'closed' | 'open' | 'half-open';
    fires: number;
    failures: number;
    successes: number;
    rejects: number;
    latencyMean: number;
  };
}

export type StatusResponse =
  | { status: 'waiting'; position: number; queueDepth: number; estimatedWaitSeconds: number }
  | { status: 'admitted'; ticket: string; expiresInSeconds: number };

export type CheckoutResponse =
  | { status: 'purchased'; unitNumber: number; reservationId: string }
  | { status: 'sold_out' }
  | { message: string; error: string; statusCode: number };

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export const api = {
  join: (saleId: string) =>
    fetch(`${API_URL}/queue/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saleId }),
    }).then((res) => json<{ queueId: string; saleId: string }>(res)),

  status: (saleId: string, queueId: string) =>
    fetch(`${API_URL}/queue/status/${queueId}?saleId=${saleId}`).then((res) =>
      json<StatusResponse>(res),
    ),

  checkout: (ticket: string) =>
    fetch(`${API_URL}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ticket}` },
    }).then(async (res) => ({ httpStatus: res.status, body: await json<CheckoutResponse>(res) })),

  stats: (saleId: string) =>
    fetch(`${API_URL}/stats?saleId=${saleId}`).then((res) => json<Stats>(res)),

  setChaos: (enabled: boolean) =>
    fetch(`${API_URL}/admin/chaos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then((res) => json<{ chaosEnabled: boolean }>(res)),

  reset: (saleId: string) =>
    fetch(`${API_URL}/admin/reset?saleId=${saleId}`, { method: 'POST' }).then((res) =>
      json<{ reset: boolean; saleId: string }>(res),
    ),
};

export const SALE_ID = 'DROP-001';
