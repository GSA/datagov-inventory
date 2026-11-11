import type { FormModel } from '../types'

export const UseRestrictionModel: FormModel = {
  className: 'UseRestriction',
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
      helpText: 'Significant information pertaining to the use or reproduction of the data',
    },
{
      name: 'restrictionStatus',
      label: 'Restriction Status',
      type: 'object',
      required: true,
      cardinality: 'single',
      helpText: 'Indication of whether or not there are use restrictions on the archival materials, consider using a controlled vocabulary such as https://www.archives.gov/research/catalog/lcdrg/authority-lists/use-restriction-status',
      allowedClasses: ['Concept'],
    },
{
      name: 'specificRestriction',
      label: 'Specific Restriction',
      type: 'object',
      required: false,
      cardinality: 'single',
      helpText: 'Authority, code list entry, or policy reference that defines the specific use restriction; consider using a controlled vocabulary such as the NARA https://www.archives.gov/research/catalog/lcdrg/authority-lists/specific-use-restriction',
      allowedClasses: ['Concept'],
    }
  ],
}
