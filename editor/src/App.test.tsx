import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('opens on the start page, with the government banner and a way to import', async () => {
    render(<App />)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit your DCAT-US 3.0 catalog in this browser' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/An official website of the United States government/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Import a catalog' })).toHaveAttribute('href', '/import')
    expect(screen.getByRole('link', { name: 'Editor' })).toHaveAttribute('href', '/editor')
  })
})
