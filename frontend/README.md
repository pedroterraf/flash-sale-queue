# frontend

UI de demo en Next.js 15 (App Router). Sin routing, sin server components haciendo nada interesante — es una sola página (`app/page.tsx`) que compone cuatro client components, cada uno polleando la API por su cuenta. Todas las llamadas a la API viven en `lib/api.ts`, tipadas exactamente contra lo que devuelve el backend.

## `components/QueueFlow.tsx` — el recorrido real del usuario

Una pequeña máquina de estados (`idle → waiting → admitted → purchasing → purchased | sold_out | error`) manejada con un solo `useState<Phase>`:

1. **`idle`** — botón "Unirme a la cola". El click llama a `api.join()`, guarda el `queueId` devuelto, y arranca un `setInterval` que pollea `api.status()` cada 700ms.
2. **`waiting`** — muestra posición + tiempo estimado según lo que devolvió el último poll. Cada respuesta de poll reemplaza la fase entera, así que no hay "diffing" manual — la UI siempre es exactamente lo que dijo la última respuesta.
3. **`admitted`** — el poll devolvió un ticket; se limpia el interval (`stopPolling()`) porque ya no hay nada que esperar. "Comprar ahora" llama a `api.checkout(ticket)`.
4. **`purchased` / `sold_out` / `error`** — estados terminales según la respuesta del checkout. "Empezar de nuevo" solo resetea `Phase` a `idle`; no llama a ningún endpoint de reset, así que el estado de stock/cola *de la demo* queda intacto — solo se resetea tu UI local, y es a propósito (para eso está el botón "Reiniciar demo" de `AdminControls`, que es una preocupación separada).

Vale la pena notar: el componente nunca asume que es él quien se admite solo porque está polleando. Refleja lo que sea que diga `api.status()` — en el backend, la admisión puede pasarle al poll de *otro* cliente distinto (ver la sección "queue" del README del backend), y este componente no necesita saberlo ni importarle.

## `components/StatsPanel.tsx` — solo lectura, pollea `/stats` cada 1s

Renderiza lo que sea que diga la forma `Stats` del backend, más una barra de progreso de stock y un badge con color según `breaker.state` (`closed` = verde, `half-open` = ámbar, `open` = rojo). Si un poll falla (la API todavía no está arriba), simplemente... sigue mostrando el último estado conocido — sin UI de error, porque un tropiezo de `/stats` no es algo que alguien viendo la demo necesite ver.

## `components/AdmissionRateChart.tsx` — el gráfico que prueba el rate-limiting

Gráfico de barras en SVG hecho a mano (sin librería de charts), polleando `GET /stats/timeseries` cada 1s. Cada barra es la cantidad de admisiones de un segundo específico de los últimos 30; una línea punteada marca la tasa configurada. Tiene tooltip al pasar el mouse (mostrado tanto como texto en un `<text>` flotante dentro del propio SVG, como en una línea de texto debajo del gráfico). Es la prueba visual más directa de todo el proyecto: cuando activás "Simular caída downstream" y forzás algunos checkouts, se ve el circuit breaker abrirse en el badge de arriba mientras el gráfico sigue mostrando que la admisión nunca superó el límite.

## `components/AdminControls.tsx` — los dos botones que hacen esto demostrable en vivo

- **Simular caída downstream** — `POST /admin/chaos {enabled: true}`. Hacé esto, y después esperá a que el badge del breaker en `StatsPanel` pase solo a `open` (si hay checkouts en vuelo), o simplemente apretá "Comprar ahora" sobre un ticket admitido un par de veces para forzarlo.
- **Reiniciar demo** — `POST /admin/reset` y después un reload completo de la página, para que cada componente arranque de cero. Útil entre tomas si estás mostrando esto en vivo y no querés tener que explicar "ignorá ese número de stock, es de hace diez minutos".

## Env

`NEXT_PUBLIC_API_URL` (ver `.env.local.example`) — por defecto es `http://127.0.0.1:3001` en `lib/api.ts` si no está seteada (127.0.0.1 y no `localhost`, ver el gotcha de Windows en el README raíz), así que `npm run dev` funciona sin configurar nada contra el setup default de `docker-compose.yml`. Solo hace falta tocarla si cambiás el puerto de la API o la corrés en otro lado que no sea localhost.

## Correrlo solo

```bash
npm install
npm run dev       # :3000, espera que la API esté alcanzable en NEXT_PUBLIC_API_URL
```
