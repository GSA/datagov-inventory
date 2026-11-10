import type { FormModel } from '../types'

export const AddressModel: FormModel = {
  className: 'Address',
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
      name: 'country-name',
      label: 'Country-name',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'The country of the Address',
    },
{
      name: 'locality',
      label: 'Locality',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'The city of the Address',
    },
{
      name: 'postal-code',
      label: 'Postal-code',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'The postal code of the Address',
    },
{
      name: 'region',
      label: 'Region',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'The administrative area of the Address. Depending on the country, this corresponds to a province, a county, a region, or a state',
    },
{
      name: 'street-address',
      label: 'Street-address',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'The street name and civic number of an Address',
    }
  ],
}
