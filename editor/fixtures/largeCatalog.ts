/**
 * A generated DCAT-US 3.0 catalog of `datasets` datasets, each with a contact, a publisher and three
 * distributions (6 objects per dataset), for size and speed tests (#20, #23). Deterministic.
 */
export function largeCatalog(datasets = 3_000) {
  const topics = ['Air quality', 'Water use', 'Crop yields', 'Wildfires', 'Transit ridership', 'Broadband']
  const dataset = (i: number) => ({
    '@type': 'Dataset',
    title: `${topics[i % topics.length]} ${i}`,
    description: 'A generated dataset with the usual recommended properties filled in. '.repeat(4),
    identifier: `https://example.gov/datasets/${i}`,
    keyword: ['one', 'two', 'three'],
    contactPoint: { '@type': 'Kind', fn: `Data Team ${i % 50}`, hasEmail: 'mailto:data@example.gov' },
    publisher: { '@type': 'Organization', name: 'Example Agency' },
    distribution: ['csv', 'json', 'xml'].map((format) => ({
      '@type': 'Distribution',
      title: `${format.toUpperCase()} download`,
      downloadURL: `https://example.gov/${i}/data.${format}`,
    })),
  })
  return {
    '@type': 'Catalog',
    title: `Generated catalog of ${datasets.toLocaleString('en-US')} datasets`,
    dataset: Array.from({ length: datasets }, (_, i) => dataset(i)),
  }
}
