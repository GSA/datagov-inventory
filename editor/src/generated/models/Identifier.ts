import type { FormModel } from '../types'

export const IdentifierModel: FormModel = {
  className: 'Identifier',
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
      name: 'schemaAgency',
      label: 'Schema agency',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'The name of the agency that issued the identifier',
    },
{
      name: 'creator',
      label: 'Creator',
      type: 'object',
      required: false,
      cardinality: 'single',
      helpText: 'The agency that manages the identifier scheme',
      allowedClasses: ['Organization'],
    },
{
      name: 'issued',
      label: 'Issued',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'The date of formal issuance (e.g., publication) of the Identifier',
    },
{
      name: 'version',
      label: 'Version',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'Version of the identifier scheme',
    },
{
      name: 'notation',
      label: 'Notation',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'Abbreviation or code from code lists for an identifier',
    }
  ],
}
