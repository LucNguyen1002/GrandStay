import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, LanguageToggle, useI18n } from './index'

function Sample() {
  const { text } = useI18n()
  return <><p>{text('Xin chào', 'Welcome')}</p><LanguageToggle /></>
}

describe('I18nProvider', () => {
  beforeEach(() => window.localStorage.clear())

  it('switches all context text, document language and title together', () => {
    render(<I18nProvider><Sample /></I18nProvider>)

    expect(screen.getByText('Xin chào')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('vi')
    expect(document.title).toContain('Kỳ nghỉ')

    fireEvent.click(screen.getByRole('button', { name: /Đổi ngôn ngữ/ }))

    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('GrandStay | Your stay, your way')
    expect(window.localStorage.getItem('grandstay:language')).toBe('en')
  })
})
