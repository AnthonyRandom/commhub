import React, { useState } from 'react'
import { useAuthStore } from '../../stores/auth'

interface LoginProps {
  onLoginSuccess: () => void
  onSwitchToRegister: () => void
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { error, login } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      await login(username.trim(), password.trim())
      onLoginSuccess()
    } catch (error) {
      // Error is handled by the store
      console.error('Login failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">Sign In</h2>
        <p className="text-grey-500 text-xs uppercase tracking-wider">Enter your credentials</p>
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
            placeholder="Enter username"
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
            placeholder="Enter password"
            disabled={isSubmitting}
          />
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
          disabled={isSubmitting || !username.trim() || !password.trim()}
          className="w-full bg-white text-black border-2 border-white hover:bg-grey-100 disabled:bg-grey-700 disabled:text-grey-500 disabled:border-grey-700 font-bold py-3 px-4 transition-colors uppercase tracking-wide disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin mr-2"></div>
              Signing in...
            </div>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
    </div>
  )
}

export default Login
