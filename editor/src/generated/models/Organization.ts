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
      label: 'Sub Organization Of',
      type: 'array',
      required: false,
      cardinality: 'single',
      helpText: 'Represents hierarchical containment of Organizations or OrganizationalUnits; indicates an Organization which contains this Organization',
    },
{
      name: 'altLabel',
      label: 'Alt Label',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'alternative name (trading name, colloquial name) for an organization',
    },
{
      name: 'notation',
      label: 'Notation',
      type: 'array',
      required: false,
      cardinality: 'single',
      helpText: 'List of abbreviations or codes from code lists for an organization (e.g. DOI, DOD)',
    },
{
      name: 'prefLabel',
      label: 'Pref Label',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'Preferred or legal name of the organization',
    }
  ],
}
