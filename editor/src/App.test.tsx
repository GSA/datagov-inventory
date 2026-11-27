import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./storage/IndexedDbCatalogRepository', () => ({
  IndexedDbCatalogRepository: class {
    listCatalogs = vi.fn().mockResolvedValue([])
  },
}))

describe('App', () => {
  it('opens on the start page, with the government banner and a way to import', async () => {
    render(<App />)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit your DCAT-US 3.0 catalog in this browser' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/An official website of the United States government/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a catalog' })).toHaveAttribute('href', '/import')
  })
})
