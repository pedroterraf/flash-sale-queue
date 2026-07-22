# load-test

Un solo archivo, `run.js` — Node 18+ puro (`fetch`, `performance.now()`, nada más), sin dependencia de k6/Artillery/autocannon que instalar. Se corre contra un stack levantado:

```bash
docker compose up -d --build   # desde la raíz del repo
node load-test/run.js
```

## Qué mide en realidad, y por qué dos fases separadas

**Fase 1 — tormenta de joins.** Dispara `JOIN_STORM_SIZE` (2000 por defecto) requests a `/queue/join` en lotes de 100 y mide percentiles de latencia + req/s sostenidos. Esta es la pregunta de "¿la puerta de entrada aguanta una estampida real?" — `/queue/join` es un `ZADD` simple, así que debería mantenerse rápido incluso bajo concurrencia pesada, y esta fase lo prueba en vez de asumirlo.

**Fase 2 — cumplimiento de la tasa.** Une a `RATE_TEST_USERS` (600 por defecto) usuarios, después pollea a cada uno hasta la admisión y hace el checkout de inmediato, registrando el timestamp real de cuándo *termina* cada checkout. Esos timestamps se agrupan por segundo desde el primer checkout, y la cuenta promedio/pico por segundo se compara contra el `ADMISSION_RATE_PER_SECOND` configurado. Este es el punto real de todo el proyecto: probar que el endpoint protegido nunca ve más tráfico que el límite configurado, sin importar cuántos clientes estén golpeando la cola.

¿Por qué no una sola fase gigante? Porque "¿la puerta de entrada aguanta carga?" y "¿el límite de tasa realmente se sostiene?" son afirmaciones distintas que necesitan mediciones distintas — mezclarlas en un solo número escondería una regresión en cualquiera de las dos.

## Por qué los resultados se agrupan por momento de *finalización*, no de admisión

El gate de admisión con script Lua (ver `../backend/README.md`) garantiza como máximo `rate` **admisiones** por segundo. Este script mide **finalizaciones** de checkout, que pasan un poco después de la admisión (viaje de red + la latencia downstream simulada de ~30-100ms del propio checkout). Que algunas finalizaciones de las admisiones del segundo *N* caigan justo después del límite del segundo es jitter esperado, no un bug de rate-limiting — esa distinción está explicada en la sección de load test del README raíz, porque es el tipo de cosa que a primera vista parece un bug y no lo es.

## Dos cosas que este script esquiva que son del cliente de test, no del servidor

- **`API_URL` usa `127.0.0.1` por defecto, no `localhost`.** En al menos una máquina de desarrollo, el `fetch` de Node resolvió `localhost` a `::1` primero y tuvo resets de conexión hablando con un mapeo de puertos de Docker que no respondía por IPv6 — `curl` no chocaba con esto (orden de resolución distinto), lo que hizo que fuera confuso de debuggear. Si ves `ECONNRESET` de inmediato en el primer request, probá `API_URL=http://127.0.0.1:3001 node load-test/run.js` explícitamente.
- **Los joins van en lotes (`batchSize`, 100 por defecto), no como un solo `Promise.all` de 2000.** Abrir miles de sockets desde un solo proceso de Node en un tick dispara límites de conexión del lado del cliente que no tienen nada que ver con la capacidad real del servidor. Un puñado de conexiones perdidas por este artefacto se capturan y se cuentan en `droppedClientConnections` en el resumen en vez de tirar abajo la corrida — las herramientas de load test reales toleran así unas pocas pruebas fallidas.

## Variables de entorno

| Variable | Default | |
|---|---|---|
| `API_URL` | `http://127.0.0.1:3001` | |
| `SALE_ID` | `DROP-001` | tiene que coincidir con lo que tenga configurado la API |
| `JOIN_STORM_SIZE` | `2000` | tamaño de la fase 1 |
| `RATE_TEST_USERS` | `600` | tamaño de la fase 2 — uno más grande tarda proporcionalmente más con un `ADMISSION_RATE_PER_SECOND` bajo |

Los números citados en la sección "Load test" del README raíz se capturaron con el `ADMISSION_RATE_PER_SECOND` y el `TOTAL_STOCK` de la API subidos temporalmente (20/s, 1000 unidades) específicamente para que la fase 2 termine en menos de un minuto — con el default de la demo en vivo de 8/s, admitir a 600 personas tarda 75 segundos solo por definición de la tasa. Subí esas dos variables en `docker-compose.yml`, reconstruí, corré el test, y después volvé a los valores originales antes de usar la demo en vivo de nuevo (o simplemente corré con un `RATE_TEST_USERS` más chico).
