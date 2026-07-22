# backend

API NestJS. Cinco cosas que vale la pena entender, en el orden en que un request realmente pasa por ellas.

## 1. `redis/` — la conexión, y los dos scripts Lua

`redis.service.ts` tiene el único cliente `ioredis` que comparte toda la app, más dos comandos atómicos definidos sobre él vía `client.defineCommand(...)`. Los dos existen porque un comando de Redis simple no alcanza por sí solo:

- **`releaseLock(key, token)`** — `GET key == token ? DEL key : no-op`. Liberar un lock nunca puede hacer un `DEL` a ciegas; si el lock de este request ya expiró y otro lo agarró, un delete ciego liberaría el lock *de otro*. El compare-and-delete tiene que pasar como un solo paso atómico, por eso Lua en vez de un `GET` seguido de un `DEL` separado desde Node.
- **`admitNext(queueKey, bucketKey, rate, ttl)`** — el gate de admisión en sí. Ver `queue/` más abajo; este es el arreglo del bug de ráfagas descripto en el README raíz.

`isHealthy()` hace un `PING` con timeout corto — lo usa `/stats` para reportar la salud de Redis, y es lo que permitiría a quien llame fallar cerrado si Redis mismo no responde.

## 2. `queue/` — la sala de espera

`queue.service.ts` es el gate de admisión FIFO:

- `join()` — `ZADD queue:{saleId} <timestamp> <queueId>`. Un sorted set indexado por el momento de llegada da orden FIFO estricto y consultas de posición O(log n) gratis.
- `status()` — se llama en cada poll del cliente (cada ~700ms desde el frontend). **No** confía en "mi posición parece elegible, dejame entrar" — en cambio llama a `admitNext` (el script Lua), que es lo único autorizado a sacar a alguien de la cola, limitado por una key de token-bucket por segundo (`admission:tokens:{saleId}:{unixSecond}`, tope en `rate`, TTL de 130s). A quien sea que se saque —que puede no ser quien disparó la llamada— se le escribe un JWT en `ticket:{saleId}:{queueId}` de inmediato. Quien llamó simplemente chequea después si *su propia* key de ticket ya existe.

¿Por qué manejarlo con polls en vez de un cron/interval? No hay worker en segundo plano que mantener vivo, no hay modo de falla "qué pasa si el worker se muere", y escala solo a cero carga cuando nadie está polleando — la contra es que la admisión solo avanza tan rápido como alguien, en algún lado, esté polleando, lo cual en la práctica no es un problema porque cada cliente esperando pollea todo el tiempo.

## 3. `checkout/` — la parte que realmente tiene rate-limit

Este es el endpoint que toda la cola existe para proteger, así que entrar requiere un ticket de admisión (`admission.guard.ts`), y el ticket solo sobrevive un uso:

- **`AdmissionGuard`** chequea dos cosas, no una: la firma del JWT (sin estado, rápida de verificar) *y* que `ticket:{saleId}:{queueId}` todavía exista en Redis (con estado, revocable). Una firma válida sola no alcanza — ver el "segundo bug" del README para entender por qué.
- **`DistributedLockService`** — `SET lock:sale:{saleId} <token> NX PX <ttl>` para adquirir, el script `releaseLock` para liberar. Deliberadamente de un solo nodo, no el algoritmo Redlock multi-nodo (eso resuelve sobrevivir a que un nodo de Redis se muera en medio de un lock, un problema distinto al que tiene esta demo con una sola instancia).
- **`CheckoutService.purchase()`** corre entera dentro de `lock.withLock(...)`: chequea stock, llama al downstream simulado a través del circuit breaker, descuenta stock. Una vez que eso resuelve —comprado o realmente agotado— se borra el ticket. Si el cuerpo del lock *lanza una excepción* (breaker abierto, timeout del downstream), la línea del `del` nunca se ejecuta, así que una falla transitoria no le quema el único intento al cliente.

## 4. `inventory/` — lo que se está protegiendo

Representa lo que llamaría un checkout real con latencia y modos de falla de verdad (autorización de pago, un sistema de fulfillment, ...). `reserveUnit()` duerme 30–100ms y, cuando `chaos:enabled` está activo, siempre lanza una excepción — eso es toda la "caída simulada" que activa la UI de la demo. `decrementStock()` es la única parte que toca estado real, y solo corre dentro del lock del checkout.

## 5. `stats/` — solo lectura + controles de demo

`GET /stats` agrega profundidad de cola, contadores de admitidos/vendidas, salud de Redis, y `CheckoutService.getBreakerStats()` (los contadores propios de opossum — `fires`, `failures`, `rejects`, percentiles de latencia). `GET /stats/timeseries` devuelve las cuentas de admisión por segundo de los últimos N segundos, leyendo directamente las mismas keys de token-bucket que usa `admitNext` — es lo que alimenta el gráfico del frontend, sin un pipeline de métricas separado que se pueda desincronizar. `POST /admin/chaos` prende o apaga la simulación de fallas; `POST /admin/reset` borra todas las keys de una venta para poder repetir la demo sin reiniciar los contenedores.

## Config

Todo lo configurable vive en `src/config/constants.ts`, leído de variables de entorno con valores por defecto razonables (`docker-compose.yml` pone `TOTAL_STOCK=300`, `ADMISSION_RATE_PER_SECOND=8` para la demo en vivo — el load test en `../load-test/` los pisa temporalmente para terminar en un tiempo razonable; ver el README de esa carpeta).

## Correrlo solo (sin Docker)

```bash
npm install
REDIS_URL=redis://localhost:6379 npm run start:dev   # necesita un Redis alcanzable en esa URL
```
