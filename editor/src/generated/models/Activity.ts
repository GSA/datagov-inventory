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
      type: 'object',
      required: false,
      cardinality: 'multiple',
      helpText: 'List of categories for the Activity',
      allowedClasses: ['Concept'],
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
