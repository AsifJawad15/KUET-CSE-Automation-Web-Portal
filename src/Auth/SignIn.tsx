"use client";

import { useAuth } from '@/contexts/AuthContext';
import {
    AlertCircle,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Mail
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SignInProps {
  onToggleForm: () => void;
}

export default function SignIn({ onToggleForm }: SignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email.trim(), password);
    
    if (result.success) {
      router.replace('/dashboard');
    } else {
      setError(result.error || 'Login failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Welcome Back
        </h2>
        <p className="text-sm text-gray-500">
          Secure access for department administration and teaching workflows
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              placeholder="name@cse.kuet.ac.bd"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="input-primary pl-10"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="input-primary pl-10 pr-10"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
          Use the account assigned by the department office. Passwords are verified securely on the server.
        </p>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <button
          onClick={onToggleForm}
          className="font-semibold text-gray-900 underline"
        >
          Contact Admin
        </button>
      </p>
    </div>
  );
}
