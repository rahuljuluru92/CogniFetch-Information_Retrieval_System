import pino from "pino";

export function createLogger(env) {
  const usePretty = !env.isProduction && !env.isTest;
  return pino({
    level: env.isTest ? "silent" : env.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'res.headers["set-cookie"]',
        "*.password",
        "*.apikey",
        "*.key",
      ],
      censor: "[redacted]",
    },
    ...(usePretty && {
      transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } },
    }),
  });
}
