import React, { useState } from 'react'
import Login from './Login'
import Register from './Register'

const Auth: React.FC = () => {
  const [view, setView] = useState<'login' | 'register'>('login')

  return (
    <div className="min-h-screen bg-grey-950 flex items-center justify-center p-4">
      {/* Main content */}
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white border-2 border-black mb-6">
            <span className="text-3xl font-bold text-black">C</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">CommHub</h1>
          <p className="text-grey-400 text-sm uppercase tracking-wider">
            Minimal Communication Platform
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-grey-900 border-2 border-grey-800 p-8">
          {view === 'register' ? (
            <Register
              onRegisterSuccess={() => setView('login')}
              onSwitchToLogin={() => setView('login')}
            />
          ) : (
            <Login
              onLoginSuccess={() => setView('login')}
              onSwitchToRegister={() => setView('register')}
            />
          )}

          {/* Form switcher */}
          <div className="mt-6 pt-6 border-t-2 border-grey-800 text-center">
            <p className="text-grey-400 text-sm">
              {view === 'login' ? "Don't have an account?" : 'Already have an account?'}
              <button
                onClick={() => setView(view === 'login' ? 'register' : 'login')}
                className="ml-2 text-white hover:text-grey-300 font-bold transition-colors uppercase tracking-wide"
              >
                {view === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-grey-600 text-xs uppercase tracking-wider">© 2025 CommHub</p>
        </div>
      </div>
    </div>
  )
}

export default Auth
