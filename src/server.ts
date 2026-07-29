import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = buildApp();

app
  .listen({ host: env.HOST, port: env.PORT })
  .catch((err) => {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  });
