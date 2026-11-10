import type { FormModel } from '../types'

export const AttributionModel: FormModel = {
  className: 'Attribution',
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
      helpText: 'The function of an entity or agent with respect to another entity or resource',
    },
{
      name: 'agent',
      label: 'Agent',
      type: 'object',
      required: true,
      cardinality: 'single',
      helpText: 'The agent that plays a role in the resource',
      allowedClasses: ['Agent'],
    }
  ],
}
