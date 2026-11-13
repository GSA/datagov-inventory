import type { FormModel } from '../types'

export const ConceptModel: FormModel = {
  className: 'Concept',
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
      name: 'altLabel',
      label: 'Alt Label',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'Alternative label for a concept',
    },
{
      name: 'definition',
      label: 'Definition',
      type: 'string',
      required: false,
      cardinality: 'single',
      helpText: 'Definition of the controlled vocabulary term',
    },
{
      name: 'inScheme',
      label: 'In Scheme',
      type: 'object',
      required: false,
      cardinality: 'single',
      helpText: 'Concept scheme defining this concept',
      allowedClasses: ['ConceptScheme'],
    },
{
      name: 'notation',
      label: 'Notation',
      type: 'string',
      required: false,
      cardinality: 'multiple',
      helpText: 'List of abbreviations or codes from code lists for the Concept',
    },
{
      name: 'prefLabel',
      label: 'Pref Label',
      type: 'string',
      required: true,
      cardinality: 'single',
      helpText: 'Preferred label for the term',
    }
  ],
}
