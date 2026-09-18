// Must be required before any other module (see the very first line of
// server.js) so Sentry can instrument everything correctly.
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  integrations: [
    // Profiling
    nodeProfilingIntegration(),
    // Application Metrics (CPU, memory, event loop lag, etc.)
    Sentry.nodeRuntimeMetricsIntegration(),
  ],

  // Error monitoring is on by default once dsn is set — no extra option needed.

  // Logging: send Sentry.logger.*() calls to Sentry.
  enableLogs: true,

  // Tracing: capture 100% of transactions in this demo.
  tracesSampleRate: 1.0,

  // Profiling: profile for 100% of sampled traces.
  profileSessionSampleRate: 1.0,
  profileLifecycle: "trace",

  // Application Metrics: enable custom Sentry.metrics.*() calls.
  enableMetrics: true,
});
