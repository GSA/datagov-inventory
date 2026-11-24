export interface CatalogObject {
    /** Identity within this graph. A raw graph may use any unique keys; a CatalogWorkspace always uses UUIDs.
     * The `@id` field, if any, stays in `properties`, because input `@id`s can repeat. */
    id: string
    /**
     * The DCAT-US 3.0 class the schema allows where the object sits. Its `@type` only
     * chooses among several, or names a subclass (an Organization where an Agent is
     * allowed). The top level's class comes from its `@type`.
     */
    dcatClass: string
    /** Every property that is not a link, unknown ones included, with values exactly as read. */
    properties: Record<string, unknown>
    /** Class-valued properties: property name → child ids, in source order. */
    links: Record<string, string[]>
    /** Link properties whose source value was one object rather than an array, so export can write them back the same way. */
    singleLinks: string[]
}

export interface CatalogGraph {
    rootId: string
    /** Every object by id, in document order: each object comes after the first object that links to it. */
    objects: Map<string, CatalogObject>
}

/** An accepted catalog working copy: its catalog and object identities are application-generated UUIDs. */
export interface CatalogWorkspace {
    /** Stable identity of this loaded catalog, separate from its root object's identity. */
    id: string
    /** The file name, sample name, "Pasted JSON" or "Blank catalog". */
    sourceName: string
    /** How many identical copies were merged into shared objects when it was imported (ADR 0008); absent if none. */
    merged?: number
    /** Every object and link uses an application-generated UUID, never a source-location id. */
    catalog: CatalogGraph
}
