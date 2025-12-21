import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ActorType, EntityType, EventType } from "@prisma/client";

type CreateActivityEventInput = {
  companyId: number;

  actorType: ActorType;
  actorId?: number | null;
  actorName?: string | null;

  entityType: EntityType;
  entityId?: number | null;

  eventType: EventType;
  summary?: string;
  meta?: Prisma.InputJsonValue;

};

export async function createActivityEvent(input: CreateActivityEventInput) {
  return prisma.activityEvent.create({
    data: {
      companyId: input.companyId,

      actorType: input.actorType,
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,

      entityType: input.entityType,
      entityId: input.entityId ?? null,

      eventType: input.eventType,
      summary: input.summary,
      meta: input.meta,
    },
  });
}
