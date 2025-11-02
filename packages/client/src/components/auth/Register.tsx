import React, { useState } from 'react'
import { useAuthStore } from '../../stores/auth'

interface RegisterProps {
  onRegisterSuccess: () => void
  onSwitchToLogin: () => void
}

const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { error, register } = useAuthStore()

  const passwordsMatch = password === confirmPassword
  const canSubmit = username.trim() && email.trim() && password && passwordsMatch && !isSubmitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }

    setIsSubmitting(true)
    try {
      await register(username.trim(), email.trim(), password)
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
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            required
            className="w-full px-4 py-3 bg-grey-850 border-2 border-grey-700 text-white placeholder-grey-600 focus:border-white transition-colors disabled:opacity-50"
            placeholder="Choose username"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-grey-500 uppercase tracking-wide">
            Letters, numbers, underscores
          </p>
        </div>

        {/* Email Input */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-bold text-grey-400 mb-2 uppercase tracking-wider"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            required
            className="w-full px-4 py-3 bg-grey-850 border-2 border-grey-700 text-white placeholder-grey-600 focus:border-white transition-colors disabled:opacity-50"
            placeholder="Enter email"
            disabled={isSubmitting}
          />
        </div>

        {/* Password Input */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-bold text-grey-400 mb-2 uppercase tracking-wider"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            required
            className="w-full px-4 py-3 bg-grey-850 border-2 border-grey-700 text-white placeholder-grey-600 focus:border-white transition-colors disabled:opacity-50"
            placeholder="Create password"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-grey-500 uppercase tracking-wide">
            Min 8 chars, mixed case, number, special
          </p>
        </div>

        {/* Confirm Password Input */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-bold text-grey-400 mb-2 uppercase tracking-wider"
          >
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            required
            className={`w-full px-4 py-3 bg-grey-850 border-2 text-white placeholder-grey-600 focus:border-white transition-colors disabled:opacity-50 ${
              password && confirmPassword && !passwordsMatch ? 'border-red-500' : 'border-grey-700'
            }`}
            placeholder="Confirm password"
            disabled={isSubmitting}
          />
          {password && confirmPassword && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-400 font-bold uppercase tracking-wide">
              Passwords do not match
            </p>
          )}
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
