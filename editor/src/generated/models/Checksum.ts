import type { FormModel } from '../types'

export const ChecksumModel: FormModel = {
  className: 'Checksum',
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
      name: 'algorithm',
      label: 'Algorithm',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'The algorithm used to produce the checksum',
    },
{
      name: 'checksumValue',
      label: 'Checksum Value',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'A lower case hexadecimal encoded digest value produced using a specific algorithm',
    }
  ],
}
