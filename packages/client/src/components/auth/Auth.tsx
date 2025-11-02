import React, { useState } from 'react'
import Login from './Login'
import Register from './Register'

const Auth: React.FC = () => {
  const [view, setView] = useState<'login' | 'register'>('login')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mb-4 shadow-lg">
            <span className="text-2xl font-bold text-white">C</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">CommHub</h1>
          <p className="text-gray-400">Connect with your community</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
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
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              {view === 'login' ? "Don't have an account?" : 'Already have an account?'}
              <button
                onClick={() => setView(view === 'login' ? 'register' : 'login')}
                className="ml-2 text-purple-400 hover:text-purple-300 font-medium transition-colors duration-200"
              >
                {view === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 text-xs">© 2024 CommHub. Built for communities.</p>
        </div>
      </div>
    </div>
  )
}

export default Auth
