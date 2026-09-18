# Node.js + Express + Sentry — demo con 2 errores intencionales

## Setup

```bash
cd nodejs-demo
npm install
export SENTRY_DSN="https://xxxx@oXXXX.ingest.sentry.io/XXXX"   # tu DSN real
npm start
```

Servidor en http://localhost:3001. `GET /` lista los endpoints.

Si no tienes un proyecto de Sentry todavía: https://sentry.io → **Create
Project** → plataforma **Node.js**, con los 5 productos activados (Error
monitoring, Logging, Tracing, Profiling, Application Metrics) → copia el DSN.
`instrument.js` ya está configurado para los 5:

```js
integrations: [nodeProfilingIntegration(), Sentry.nodeRuntimeMetricsIntegration()],
enableLogs: true,             // Logging
tracesSampleRate: 1.0,        // Tracing
profileSessionSampleRate: 1.0, profileLifecycle: "trace", // Profiling
enableMetrics: true,          // Application Metrics
```

Los endpoints usan `Sentry.logger.*()` y `Sentry.metrics.*()` para que veas
logs y métricas junto a los errores en Sentry, no solo los dos bugs.

## Los dos bugs

### Bug 1 — `GET /api/users/2/profile`

```bash
curl http://localhost:3001/api/users/2/profile
```

El handler hace `user.profile.email` sin comprobar que `profile` exista.
"Bob" (id 2) no tiene `profile`, así que lanza:

```
TypeError: Cannot read properties of undefined (reading 'email')
```

`Sentry.setupExpressErrorHandler(app)` captura el error con la ruta,
params y stack trace completos.

**Corrección:**
```js
if (!user) return res.status(404).json({ error: "user not found" });
res.json({ name: user.name, email: user.profile.email });
```

### Bug 2 — `POST /api/orders/calculate` sin `items`

```bash
curl -X POST http://localhost:3001/api/orders/calculate \
  -H "Content-Type: application/json" \
  -d '{}'
```

El handler asume que `items` es un array y llama `.reduce(...)`
directamente. Sin `items`, lanza:

```
TypeError: Cannot read properties of undefined (reading 'reduce')
```

**Corrección:**
```js
if (!Array.isArray(items)) {
  return res.status(400).json({ error: "items must be an array" });
}
```

## Flujo esperado con Sentry

1. Dispara los dos bugs con `curl` (o Postman).
2. En Sentry verás dos Issues nuevos, cada uno con el stack trace apuntando
   a la línea exacta y el contexto de la request (`req.params`, `req.body`,
   ruta, método).
3. Aplica el guard/validación de arriba, redeploy, y el error deja de
   reproducirse — puedes marcar el Issue como resuelto en Sentry.
