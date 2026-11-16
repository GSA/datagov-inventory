import type { FormModel } from '../types'

export const ConceptSchemeModel: FormModel = {
  className: 'ConceptScheme',
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
      name: 'version',
      label: 'Version',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'A version number or other version designation of the concept scheme',
    },
{
      name: 'created',
      label: 'Created',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'The date on which the Concept Scheme was first created',
    },
{
      name: 'description',
      label: 'Description',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'A description of the concept scheme',
    },
{
      name: 'issued',
      label: 'Issued',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'The date of formal issuance (e.g., publication) of the concept scheme',
    },
{
      name: 'modified',
      label: 'Modified',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'The most recent date at which the concept scheme was changed or modified',
    },
{
      name: 'title',
      label: 'Title',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'The title of the concept scheme',
    }
  ],
}
