import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RegisterPage from '@/app/register/page'
import { register } from '@/app/actions/auth'

// Mock server action
jest.mock('@/app/actions/auth', () => ({
  register: jest.fn(),
}))

const mockRegister = register as jest.MockedFunction<typeof register>

// Mock next-auth
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}))

// Mock next/navigation
const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('RegisterPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock navigator.language if window is available
    if (typeof window !== 'undefined') {
      Object.defineProperty(window.navigator, 'language', {
        writable: true,
        configurable: true,
        value: 'en-US',
      })
    }
  })

  it('should render registration form', () => {
    render(<RegisterPage />)

    expect(
      screen.getByRole('heading', { name: /create account/i })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
  })

  it('should handle successful registration', async () => {
    mockRegister.mockResolvedValueOnce({ success: true })

    render(<RegisterPage />)

    const nameInput = screen.getByLabelText(/name/i)
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const submitButton = screen.getByRole('button', {
      name: /create account/i,
    })

    fireEvent.change(nameInput, { target: { value: 'Test User' } })
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('should display error message on failed registration', async () => {
    mockRegister.mockResolvedValueOnce({
      error: 'User with this email already exists',
    })

    render(<RegisterPage />)

    const nameInput = screen.getByLabelText(/name/i)
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const submitButton = screen.getByRole('button', {
      name: /create account/i,
    })

    fireEvent.change(nameInput, { target: { value: 'Test User' } })
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(
        screen.getByText(/user with this email already exists/i)
      ).toBeInTheDocument()
    })
  })

  it('should show loading state during registration', async () => {
    mockRegister.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ success: true }), 100)
        )
    )

    render(<RegisterPage />)

    const nameInput = screen.getByLabelText(/name/i)
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const submitButton = screen.getByRole('button', {
      name: /create account/i,
    })

    fireEvent.change(nameInput, { target: { value: 'Test User' } })
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    expect(screen.getByText(/creating account/i)).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})
