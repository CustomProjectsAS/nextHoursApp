// lib/log.ts
type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const REDACT_KEYS = [
  // credentials
  "password",
  "passwordhash",

  // generic secrets
  "secret",
  "auth_secret",
  "client_secret",
  "privatekey",

  // tokens
  "token",
  "session",
  "sessiontoken",
  "invitetoken",
  "access_token",
  "refresh_token",
  "id_token",

  // api keys
  "apikey",
  "api_key",

  // headers / cookies
  "authorization",
  "cookie",
  "set-cookie",

  // infra / env
  "database_url",
];


function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const keyLower = k.toLowerCase();
      if (REDACT_KEYS.includes(keyLower)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }

  return value;
}

function emit(level: LogLevel, message: string, ctx?: LogContext) {
  const record = {
    ts: new Date().toISOString(),
    level,
    message,
    // ctx must always exist to be "predictable schema"
    ctx: ctx ? (redact(ctx) as Record<string, unknown>) : {},
  };

  // One JSON per line. Plays nicely with Render, CloudWatch, ELK, etc.
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](JSON.stringify(record));
}


export const log = {
  debug: (message: string, ctx?: LogContext) => emit("debug", message, ctx),
  info: (message: string, ctx?: LogContext) => emit("info", message, ctx),
  warn: (message: string, ctx?: LogContext) => emit("warn", message, ctx),
  error: (message: string, ctx?: LogContext) => emit("error", message, ctx),
};
