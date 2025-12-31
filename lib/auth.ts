import { prisma } from "@/lib/prisma";
import { createHash, createHmac } from "crypto";

const SESSION_COOKIE = "cph_session";

export type AuthContext = {
  employeeId: number;
  companyId: number;
  role: "EMPLOYEE" | "ADMIN" | "OWNER";
  name: string;
  companyName: string;
};

export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const token = parseCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;

  const tokenHash = sha256Hex(token);

  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      employee: true,
      company: true,
    },
  });

  if (!session) return null;

  // best-effort
  prisma.session
    .update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    employeeId: session.employeeId,
    companyId: session.companyId,
    role: session.employee.role,
    name: session.employee.name,
    companyName: session.company.name,
  };
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(name + "="));
  if (!hit) return null;
  return decodeURIComponent(hit.slice(name.length + 1));
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}




type LoginChallengePayload = {
  v: 1;
  email: string;
  employeeIds: number[]; // allowed employees for this login
  exp: number; // unix seconds
};

function base64urlEncode(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64urlDecode(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replaceAll("-", "+").replaceAll("_", "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

function sign(data: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET");
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function createLoginChallenge(input: {
  email: string;
  employeeIds: number[];
  ttlMinutes?: number;
}) {
  const ttl = input.ttlMinutes ?? 5;
  const payload: LoginChallengePayload = {
    v: 1,
    email: input.email,
    employeeIds: input.employeeIds,
    exp: Math.floor(Date.now() / 1000) + ttl * 60,
  };

  const body = base64urlEncode(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyLoginChallenge(token: string): LoginChallengePayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("Invalid challenge token format");

  const expected = sign(body);
  if (expected !== sig) throw new Error("Invalid challenge token signature");

  const payload = JSON.parse(base64urlDecode(body)) as LoginChallengePayload;

  if (payload.v !== 1) throw new Error("Unsupported challenge token version");
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Challenge token expired");
  }
  if (!payload.email || !Array.isArray(payload.employeeIds)) {
    throw new Error("Invalid challenge token payload");
  }

  return payload;
}
