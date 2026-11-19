export type CreateUuid = () => string

/** Generates an application identity. Browser UUID collisions are negligibly unlikely. */
export const createUuid: CreateUuid = () => crypto.randomUUID()
