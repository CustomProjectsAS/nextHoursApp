import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

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
