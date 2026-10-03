import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { load, save } from '../lib/storage';

// Local, browser-only accounts. This is a convenience profile for a
// client-side tool, not a security boundary.
const AuthModule = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const email = formData.email.trim().toLowerCase();
    if (!email || !formData.password) return setError('Please fill in all fields');

    if (isRegistering) {
      if (!formData.name.trim()) return setError('Name is required');
      if (load('user_' + email, null)) return setError('An account with this email already exists, so sign in instead');
      if (formData.password.length < 6) return setError('Password must be at least 6 characters');
      const newUser = { name: formData.name.trim(), email, password: formData.password };
      save('user_' + email, newUser);
      save('current_user', { name: newUser.name, email });
      onLogin({ name: newUser.name, email });
      return undefined;
    }

    const user = load('user_' + email, null);
    if (!user) return setError('User not found, please create an account');
    if (user.password !== formData.password) return setError('Invalid password');
    save('current_user', { name: user.name, email: user.email });
    onLogin({ name: user.name, email: user.email });
    return undefined;
  };

  const inputCls = 'w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="bg-slate-900 p-8 text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/50">
            <span className="text-2xl font-bold text-white">W</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">WorkX</h1>
          <p className="text-slate-400 text-sm mt-2">Workforce Planning &amp; Analytics Suite</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
            {isRegistering ? 'Create Account' : 'Welcome Back'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {isRegistering && (
              <label className="block">
                <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</span>
                <input type="text" name="name" autoComplete="name" value={formData.name} onChange={handleChange} className={inputCls} placeholder="Jane Doe" />
              </label>
            )}
            <label className="block">
              <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</span>
              <input type="email" name="email" autoComplete="email" value={formData.email} onChange={handleChange} className={inputCls} placeholder="name@company.com" />
            </label>
            <label className="block">
              <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</span>
              <input type="password" name="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} value={formData.password} onChange={handleChange} className={inputCls} placeholder="••••••••" />
            </label>

            {error && (
              <div role="alert" className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-200 transition-all">
              {isRegistering ? 'Register' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            {isRegistering ? 'Already have an account? ' : 'New to WorkX? '}
            <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="text-blue-600 font-bold hover:underline">
              {isRegistering ? 'Sign In' : 'Create Account'}
            </button>
          </div>
          <p className="mt-4 text-[11px] text-center text-slate-400">Accounts and data are stored only in this browser</p>
        </div>
      </div>
    </div>
  );
};

export default AuthModule;
