import type { FormModel } from '../types'

export const AgentModel: FormModel = {
  className: 'Agent',
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
      name: 'category',
      label: 'Category',
      type: 'object',
      required: false,
      cardinality: 'multiple',
      helpText: 'The type of the agent that makes the item available',
      allowedClasses: ['Concept'],
    },
{
      name: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'The name of the agent',
    }
  ],
}
