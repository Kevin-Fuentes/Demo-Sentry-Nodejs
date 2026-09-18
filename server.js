// Must be the very first require so Sentry instruments everything else.
require("./instrument.js");

const express = require("express");
const Sentry = require("@sentry/node");

const app = express();
app.use(express.json());

// In-memory data. Notice user 2 ("Bob") has no `profile` field, e.g. because
// their signup flow never completed.
const users = [
  { id: 1, name: "Alice", profile: { email: "alice@example.com" } },
  { id: 2, name: "Bob" }, // <-- no `profile` here
];

app.get("/", (req, res) => {
  res.json({
    message: "Node.js + Sentry demo",
    endpoints: [
      "GET  /api/users/1/profile  (funciona)",
      "GET  /api/users/2/profile  (BUG #1: TypeError)",
      "POST /api/orders/calculate { items: [...] }  (funciona)",
      "POST /api/orders/calculate {}  (BUG #2: TypeError)",
    ],
  });
});

// BUG #1: reads `user.profile.email` without checking that `profile` exists.
// Works for Alice, throws for Bob:
//   TypeError: Cannot read properties of undefined (reading 'email')
// Express 5 forwards rejected promises / thrown errors from async handlers
// to the error-handling middleware automatically, so this reaches
// Sentry.setupExpressErrorHandler below with the full stack trace and the
// request (route, params) attached.
//
// Fix: guard the access and return 404 when the user (or profile) is missing.
//   if (!user) return res.status(404).json({ error: "user not found" });
//   res.json({ name: user.name, email: user.profile.email });
app.get("/api/users/:id/profile", async (req, res) => {
  Sentry.logger.info("Fetching user profile", { userId: req.params.id });
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "user not found" });
  if (!user.profile) return res.status(404).json({ error: "profile not found" });
  res.json({ name: user.name, email: user.profile.email });
});

// BUG #2: assumes `items` is always an array and calls `.reduce` on it
// directly. If the client omits `items` (or sends the wrong shape), this
// throws:
//   TypeError: Cannot read properties of undefined (reading 'reduce')
//
// Fix: validate the payload before using it.
//   if (!Array.isArray(items)) {
//     return res.status(400).json({ error: "items must be an array" });
//   }
app.post("/api/orders/calculate", async (req, res) => {
  const { items } = req.body;
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  // Application Metrics: track business metrics alongside errors/traces.
  Sentry.metrics.count("orders.calculated", 1);
  Sentry.metrics.distribution("orders.total", total, { unit: "none" });

  res.json({ total });
});

// Must be registered after all routes, before any other error middleware.
Sentry.setupExpressErrorHandler(app);

// Optional fallthrough handler so clients still get a JSON response.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal_server_error", sentryId: res.sentry });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Node.js + Sentry demo escuchando en http://localhost:${port}`);
});
