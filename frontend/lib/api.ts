// 127.0.0.1, not localhost: on Windows + Docker Desktop (WSL2 backend), browsers
// resolving "localhost" to ::1 can hang talking to the container's port mapping,
// which only reliably answers on IPv4. See ../README.md "Known Windows gotcha".
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const isRetryableCheckout = (error: unknown): boolean => {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 503 || error.status >= 500;
  }
  return true;
};

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
  | { status: 'sold_out' };

export interface Timeseries {
  saleId: string;
  ratePerSecond: number;
  buckets: { second: number; count: number }[];
}

async function fetchSafe(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiError(
      'No se pudo conectar con la API. Si es la primera carga, el server gratuito puede tardar ~30s en despertar.',
      0,
    );
  }
}

async function readJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

async function parseOk<T>(res: Response): Promise<T> {
  const body = await readJson<T & { message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? `Error ${res.status}`, res.status);
  }
  return body;
}

export const api = {
  join: (saleId: string) =>
    fetchSafe(`${API_URL}/queue/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saleId }),
    }).then((res) => parseOk<{ queueId: string; saleId: string }>(res)),

  status: (saleId: string, queueId: string) =>
    fetchSafe(`${API_URL}/queue/status/${queueId}?saleId=${saleId}`).then((res) =>
      parseOk<StatusResponse>(res),
    ),

  checkout: async (ticket: string): Promise<CheckoutResponse> => {
    const res = await fetchSafe(`${API_URL}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ticket}` },
    });
    const body = await readJson<CheckoutResponse | { message?: string }>(res);
    if (!res.ok) {
      throw new ApiError(
        'message' in body && typeof body.message === 'string' ? body.message : 'Falló el checkout',
        res.status,
      );
    }
    return body as CheckoutResponse;
  },

  stats: (saleId: string) =>
    fetchSafe(`${API_URL}/stats?saleId=${saleId}`).then((res) => parseOk<Stats>(res)),

  timeseries: (saleId: string, seconds: number) =>
    fetchSafe(`${API_URL}/stats/timeseries?saleId=${saleId}&seconds=${seconds}`).then((res) =>
      parseOk<Timeseries>(res),
    ),

  setChaos: (enabled: boolean) =>
    fetchSafe(`${API_URL}/admin/chaos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then((res) => parseOk<{ chaosEnabled: boolean }>(res)),

  reset: (saleId: string) =>
    fetchSafe(`${API_URL}/admin/reset?saleId=${saleId}`, { method: 'POST' }).then((res) =>
      parseOk<{ reset: boolean; saleId: string }>(res),
    ),
};

export const SALE_ID = 'DROP-001';
