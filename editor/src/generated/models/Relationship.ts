import type { FormModel } from '../types'

export const RelationshipModel: FormModel = {
  className: 'Relationship',
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
      name: 'hadRole',
      label: 'Had Role',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'The function of an entity or agent with respect to a dataset',
    },
{
      name: 'relation',
      label: 'Relation',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'The entity related to the dataset. This string should unambiguously identify the related resource using an appropriate identifier.',
    }
  ],
}
