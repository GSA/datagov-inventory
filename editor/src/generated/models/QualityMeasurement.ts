import type { FormModel } from '../types'

export const QualityMeasurementModel: FormModel = {
  className: 'QualityMeasurement',
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
      name: 'isMeasurementOf',
      label: 'Is Measurement Of',
      type: 'object',
      required: true,
      cardinality: 'single',
      helpText: 'The metric being observed',
      allowedClasses: ['Metric'],
    },
{
      name: 'value',
      label: 'Value',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'The value computed by metric',
    },
{
      name: 'unitMeasure',
      label: 'Unit Measure',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'Unit of measure associated with the value',
    }
  ],
}
