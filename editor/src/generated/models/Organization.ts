import type { FormModel } from '../types'

export const OrganizationModel: FormModel = {
  className: 'Organization',
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
      name: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'The full name of the Organization',
    },
{
      name: 'subOrganizationOf',
      label: 'Sub organization of',
      type: 'object',
      required: false,
      cardinality: 'multiple',
      helpText: 'Represents hierarchical containment of Organizations or OrganizationalUnits; indicates an Organization which contains this Organization',
      allowedClasses: ['Organization'],
    },
{
      name: 'altLabel',
      label: 'Alternative label',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'Alternative name (trading name, colloquial name) for an organization',
    },
{
      name: 'notation',
      label: 'Notation',
      type: 'string',
      required: false,
      cardinality: 'multiple',
      helpText: 'List of abbreviations or codes from code lists for an organization (e.g. DOI, DOD)',
    },
{
      name: 'prefLabel',
      label: 'Preferred label',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'Preferred or legal name of the organization',
    }
  ],
}
