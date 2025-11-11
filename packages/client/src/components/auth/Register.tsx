import React, { useState, useMemo } from 'react'
import { useAuthStore } from '../../stores/auth'
import { Check, X } from 'lucide-react'

interface RegisterProps {
  onRegisterSuccess: () => void
  onSwitchToLogin: () => void
}

interface ValidationResult {
  isValid: boolean
  message: string
}

const Register: React.FC<RegisterProps> = ({ onRegisterSuccess }) => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { error, register } = useAuthStore()

  // Username validation (must match server rules)
  const usernameValidation = useMemo((): ValidationResult => {
    if (!username) return { isValid: false, message: '' }
    if (username.length < 3) return { isValid: false, message: 'At least 3 characters' }
    if (username.length > 30) return { isValid: false, message: 'Max 30 characters' }
    if (!/^[a-zA-Z0-9_]+$/.test(username))
      return { isValid: false, message: 'Only letters, numbers, underscore' }
    return { isValid: true, message: 'Valid username' }
  }, [username])

  // Email validation
  const emailValidation = useMemo((): ValidationResult => {
    if (!email) return { isValid: false, message: '' }
    if (email.length > 254) return { isValid: false, message: 'Email too long' }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return { isValid: false, message: 'Invalid email format' }
    return { isValid: true, message: 'Valid email' }
  }, [email])

  // Password validation (server requires min 6 chars)
  const passwordValidation = useMemo((): ValidationResult => {
    if (!password) return { isValid: false, message: '' }
    if (password.length < 6) return { isValid: false, message: 'At least 6 characters' }
    if (password.length > 128) return { isValid: false, message: 'Max 128 characters' }
    return { isValid: true, message: 'Valid password' }
  }, [password])

  // Confirm password validation
  const confirmPasswordValidation = useMemo((): ValidationResult => {
    if (!confirmPassword) return { isValid: false, message: '' }
    if (password !== confirmPassword) return { isValid: false, message: 'Passwords do not match' }
    return { isValid: true, message: 'Passwords match' }
  }, [password, confirmPassword])

  const allValid =
    usernameValidation.isValid &&
    emailValidation.isValid &&
    passwordValidation.isValid &&
    confirmPasswordValidation.isValid
  const canSubmit = allValid && !isSubmitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }

    setIsSubmitting(true)
    try {
      await register(username.trim(), email.trim(), password, rememberMe)
      onRegisterSuccess()
    } catch (error) {
      // Error is handled by the store
      console.error('Registration failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSubmit) {
        handleSubmit(e as any)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">Sign Up</h2>
        <p className="text-grey-500 text-xs uppercase tracking-wider">Create new account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username Input */}
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-bold text-grey-400 mb-2 uppercase tracking-wider"
          >
            Username
          </label>
          <div className="relative">
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              required
              className={`w-full px-4 py-3 pr-10 bg-grey-850 border-2 text-white placeholder-grey-600 focus:border-white transition-colors disabled:opacity-50 ${
                username && !usernameValidation.isValid
                  ? 'border-red-500'
                  : username && usernameValidation.isValid
                    ? 'border-green-500'
                    : 'border-grey-700'
              }`}
              placeholder="Choose username"
              disabled={isSubmitting}
            />
            {username && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameValidation.isValid ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <X className="w-5 h-5 text-red-500" />
                )}
              </div>
            )}
          </div>
          {username && usernameValidation.message && (
            <p
              className={`mt-1 text-xs font-bold uppercase tracking-wide ${usernameValidation.isValid ? 'text-green-400' : 'text-red-400'}`}
            >
              {usernameValidation.message}
            </p>
          )}
        </div>

        {/* Email Input */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-bold text-grey-400 mb-2 uppercase tracking-wider"
          >
            Email
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              required
              className={`w-full px-4 py-3 pr-10 bg-grey-850 border-2 text-white placeholder-grey-600 focus:border-white transition-colors disabled:opacity-50 ${
                email && !emailValidation.isValid
                  ? 'border-red-500'
                  : email && emailValidation.isValid
                    ? 'border-green-500'
                    : 'border-grey-700'
              }`}
              placeholder="Enter email"
              disabled={isSubmitting}
            />
            {email && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {emailValidation.isValid ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <X className="w-5 h-5 text-red-500" />
                )}
              </div>
            )}
          </div>
          {email && emailValidation.message && (
            <p
              className={`mt-1 text-xs font-bold uppercase tracking-wide ${emailValidation.isValid ? 'text-green-400' : 'text-red-400'}`}
            >
              {emailValidation.message}
            </p>
          )}
        </div>

        {/* Password Input */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-bold text-grey-400 mb-2 uppercase tracking-wider"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              required
              className={`w-full px-4 py-3 pr-10 bg-grey-850 border-2 text-white placeholder-grey-600 focus:border-white transition-colors disabled:opacity-50 ${
                password && !passwordValidation.isValid
                  ? 'border-red-500'
                  : password && passwordValidation.isValid
                    ? 'border-green-500'
                    : 'border-grey-700'
              }`}
              placeholder="Create password"
              disabled={isSubmitting}
            />
            {password && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {passwordValidation.isValid ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <X className="w-5 h-5 text-red-500" />
                )}
              </div>
            )}
          </div>
          {password && passwordValidation.message && (
            <p
              className={`mt-1 text-xs font-bold uppercase tracking-wide ${passwordValidation.isValid ? 'text-green-400' : 'text-red-400'}`}
            >
              {passwordValidation.message}
            </p>
          )}
        </div>

        {/* Confirm Password Input */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-bold text-grey-400 mb-2 uppercase tracking-wider"
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              required
              className={`w-full px-4 py-3 pr-10 bg-grey-850 border-2 text-white placeholder-grey-600 focus:border-white transition-colors disabled:opacity-50 ${
                confirmPassword && !confirmPasswordValidation.isValid
                  ? 'border-red-500'
                  : confirmPassword && confirmPasswordValidation.isValid
                    ? 'border-green-500'
                    : 'border-grey-700'
              }`}
              placeholder="Confirm password"
              disabled={isSubmitting}
            />
            {confirmPassword && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {confirmPasswordValidation.isValid ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <X className="w-5 h-5 text-red-500" />
                )}
              </div>
            )}
          </div>
          {confirmPassword && confirmPasswordValidation.message && (
            <p
              className={`mt-1 text-xs font-bold uppercase tracking-wide ${confirmPasswordValidation.isValid ? 'text-green-400' : 'text-red-400'}`}
            >
              {confirmPasswordValidation.message}
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 bg-grey-850 border-2 border-grey-700 text-white focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-grey-900 cursor-pointer"
          />
          <label
            htmlFor="rememberMe"
            className="ml-2 text-sm text-grey-400 cursor-pointer select-none"
          >
            Remember me
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border-2 border-red-500 p-3">
            <p className="text-red-400 text-sm font-medium text-center">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-white text-black border-2 border-white hover:bg-grey-100 disabled:bg-grey-700 disabled:text-grey-500 disabled:border-grey-700 font-bold py-3 px-4 transition-colors uppercase tracking-wide disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin mr-2"></div>
              Creating...
            </div>
          ) : (
            'Create Account'
          )}
        </button>
      </form>
    </div>
  )
}

export default Register
