import type { FormModel } from '../types'

export const MetricModel: FormModel = {
  className: 'Metric',
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
      name: 'expectedDataType',
      label: 'Expected Data Type',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'Represents the expected data type for the metric\'s observed value (e.g., xsd:boolean, xsd:double etc...)',
    },
{
      name: 'inDimension',
      label: 'In Dimension',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'Represents the dimensions a quality metric, certificate and annotation allow a measurement of.',
    },
{
      name: 'definition',
      label: 'Definition',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'Definition of the metric.',
    }
  ],
}
