import type { FormModel } from '../types'

export const ActivityModel: FormModel = {
  className: 'Activity',
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
      type: 'array',
      required: false,
      cardinality: 'single',
      helpText: 'List of categories for the Activity',
    },
{
      name: 'label',
      label: 'Label',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'A human-readable label for the activity',
    }
  ],
}
