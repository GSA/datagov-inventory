import type { FormModel } from '../types'

export const CUIRestrictionModel: FormModel = {
  className: 'CUIRestriction',
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
      name: 'cuiBannerMarking',
      label: 'Cui Banner Marking',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'CUI (Controlled Unclassified Information) banner marking is required for any unclassified information that is deemed sensitive and requires protection; see information at https://www.archives.gov/cui/registry/category-marking-list',
    },
{
      name: 'designationIndicator',
      label: 'Designation Indicator',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'Agency that designated the information as CUI; include at least "Controlled by:" and, when possible, contact information',
    },
{
      name: 'requiredIndicatorPerAuthority',
      label: 'Required Indicator Per Authority',
      type: 'array',
      required: false,
      cardinality: 'single',
      helpText: 'List of free-text required indicators from the applicable authority (for example, category descriptions or distribution statements)',
    }
  ],
}
