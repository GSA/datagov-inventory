export interface CatalogObject {
    /** Identity within this graph. A raw graph may use any unique keys; an OpenCatalog always uses UUIDs. */
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
    /** Every object by id, in document order (each parent before its children). */
    objects: Map<string, CatalogObject>
}
