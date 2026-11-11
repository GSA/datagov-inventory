import type { FormModel } from '../types'

export const AccessRestrictionModel: FormModel = {
  className: 'AccessRestriction',
  fields: [
{
      name: '@id',
      label: '@id',
      type: 'string',
      required: false,
      cardinality: 'single',
    },
{
      name: '@type',
      label: '@type',
      type: 'string',
      required: false,
      cardinality: 'single',
    },
{
      name: 'restrictionNote',
      label: 'Restriction Note',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'A note related to the access restriction',
    },
{
      name: 'restrictionStatus',
      label: 'Restriction Status',
      type: 'object',
      required: true,
      cardinality: 'single',
      helpText: 'The indication of whether or not there are access restrictions on the item, consider using a controlled vocabulary such as https://www.archives.gov/research/catalog/lcdrg/authority-lists/access-restriction-status',
      allowedClasses: ['Concept'],
    },
{
      name: 'specificRestriction',
      label: 'Specific Restriction',
      type: 'object',
      required: false,
      cardinality: 'single',
      helpText: 'Authority, code list entry, or policy reference that defines the specific access restriction; consider using a controlled vocabulary such as the NARA https://www.archives.gov/research/catalog/lcdrg/authority-lists/specific-access-restriction',
      allowedClasses: ['Concept'],
    }
  ],
}
