import { AsyncLocalStorage } from "node:async_hooks";

type AuditContext = {
  actorId?: string;
  actorNombre?: string;
};

const storage = new AsyncLocalStorage<AuditContext>();

export const runWithAuditContext = (callback: () => void): void => storage.run({}, callback);

export const setAuditActor = (actor: { id: string; nombre: string; apellido?: string }): void => {
  const context = storage.getStore();
  if (!context) return;
  context.actorId = actor.id;
  context.actorNombre = [actor.nombre, actor.apellido].filter(Boolean).join(" ");
};

export const currentAuditWrite = () => {
  const context = storage.getStore();
  return {
    actorId: context?.actorId ?? null,
    actorNombre: context?.actorNombre ?? "Sistema",
  };
};
