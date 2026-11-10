import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the editor heading', () => {
    render(<App />)

    const heading = screen.getByRole('heading', {
      name: /DCAT-US 3.0 Catalog Editor/i
    })

    expect(heading).toBeInTheDocument()
  })

  it('renders the government banner', () => {
    render(<App />)

    const banner = screen.getByText(/An official website of the United States government/i)

    expect(banner).toBeInTheDocument()
  })

  it('renders the editor description', () => {
    render(<App />)

    const description = screen.getByText(/browser-only editor/i)

    expect(description).toBeInTheDocument()
  })
})
