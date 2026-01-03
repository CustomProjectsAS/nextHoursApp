import { prisma } from "@/lib/prisma";
import { EmployeeStatus } from "@prisma/client";
import crypto from "crypto";
import { getAuthContext } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { z } from "zod";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";
import { env } from "@/lib/env";



function generateInviteToken() {
    return crypto.randomBytes(32).toString("hex");
}

function sha256Hex(input: string) {
    return crypto.createHash("sha256").update(input).digest("hex");
}


const INVITE_EXPIRATION_DAYS = 7;
const InviteBodySchema = z
    .object({
        email: z.string().trim().toLowerCase().email(),
        role: z.enum(["EMPLOYEE", "ADMIN"]),
        name: z.string().min(1).optional(),
    })
    .strict();


export async function POST(req: Request) {

    const requestId = getOrCreateRequestId(req);
    const ctx = await getAuthContext(req);
    if (!ctx) {
        log.warn("AUTH_REQUIRED: admin/invite POST", { requestId });
        return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
    }

    if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
        log.warn("FORBIDDEN: admin/invite POST", { requestId, role: ctx.role });
        return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
    }


    const body = await req.json().catch(() => null);
    const parsed = InviteBodySchema.safeParse(body);

    if (!parsed.success) {
        return failNext("VALIDATION", "Invalid request body", 400, undefined, requestId);
    }

    const { name, email, role } = parsed.data;

    const ipRaw =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        "unknown";
    const ip = ipRaw.slice(0, 64);


    // IP-based: 30 invites / 10 minutes
    const ipKey = `admin:invite:ip:${ip}`;
    const ipLimit = await rateLimit({
        key: ipKey,
        windowSeconds: 600,
        limit: 30,
    });
    if (!ipLimit.ok) {
        return failNext("RATE_LIMIT", "Too many invites. Try again later.", 429, undefined, requestId);
    }



    // Actor-based: 20 invites / 10 minutes (per employee)
    const actorKey = `admin:invite:actor:${ctx.companyId}:${ctx.employeeId}`;
    const actorLimit = await rateLimit({
        key: actorKey,
        windowSeconds: 600,
        limit: 20,
    });
    if (!actorLimit.ok) {
        return failNext("RATE_LIMIT", "Too many invites. Try again later.", 429, undefined, requestId);
    }

    try {

        const now = new Date();
        const inviteTokenRaw = generateInviteToken();
        const inviteTokenHash = sha256Hex(inviteTokenRaw);

        const inviteExpiresAt = new Date(
            now.getTime() + INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
        );

        const companyId = ctx.companyId;
        const actorType =
            ctx.role === "OWNER" ? "OWNER" : ctx.role === "ADMIN" ? "ADMIN" : "EMPLOYEE";




        const employee = await prisma.$transaction(async (tx) => {
            const employee = await tx.employee.create({
                data: {
                    name: name ?? "",
                    email,
                    role,
                    status: EmployeeStatus.INVITED,
                    inviteTokenHash,
                    invitedAt: now,
                    inviteExpiresAt,
                    companyId,
                },

            });

            await tx.activityEvent.create({
                data: {
                    companyId,
                    actorType: actorType,
                    actorId: ctx.employeeId,
                    actorName: ctx.name ?? null,
                    entityType: "EMPLOYEE",
                    entityId: employee.id,
                    eventType: "EMPLOYEE_INVITED",
                    summary: `Invited employee #${employee.id}`,
                    meta: {
                        email: employee.email,
                        expiresAt: employee.inviteExpiresAt,
                    },
                },
            });

            return employee;
        });




        const baseUrl =
            env.NEXT_PUBLIC_APP_URL ??
            env.APP_URL ??
            "http://localhost:3000";


        const inviteUrl = `${baseUrl}/onboarding?token=${inviteTokenRaw}`;


        return okNext(
            {
                employeeId: employee.id,
                inviteLink: inviteUrl,
                expiresAt: employee.inviteExpiresAt,
            },
            undefined,
            requestId
        );


    } catch (error: any) {
        log.error("INTERNAL: admin/invite POST", {
            requestId,
            errorName: error?.name,
            errorMessage: error?.message,
            errorCode: error?.code,
        });

        // Prisma unique constraint (e.g., email)
        if (error?.code === "P2002") {
            return failNext("BAD_REQUEST", "Invite conflict", 409, undefined, requestId);
        }

        return failNext("INTERNAL", "Internal server error", 500, undefined, requestId);
    }

}
