import type { FormModel } from '../types'

export const PeriodOfTimeModel: FormModel = {
  className: 'PeriodOfTime',
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
      name: 'endDate',
      label: 'End Date',
      type: 'object',
      required: false,
      cardinality: 'single',
      helpText: 'The end date of the period of time',
    },
{
      name: 'startDate',
      label: 'Start Date',
      type: 'object',
      required: false,
      cardinality: 'single',
      helpText: 'The start date of the period of time',
    }
  ],
}
