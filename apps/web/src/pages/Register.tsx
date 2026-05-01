import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';

type Props = {
  onSuccess: () => void;
  onLogin: () => void;
};

export default function Register({ onSuccess, onLogin }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const register = useMutation({
    mutationFn: () => api.post('/api/auth/register', { name, email, password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    },
  });

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <span className="text-2xl font-bold text-brand-600">EdgeIQ</span>
        </div>
        <h2 className="text-center text-2xl font-semibold text-gray-900">Create your account</h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          Privacy-first analytics for your agency. No consent banners needed.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-xl border border-gray-200">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              register.mutate();
            }}
          >
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <div>
              <label className="label" htmlFor="name">Your name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">Minimum 8 characters</p>
            </div>
            <button
              type="submit"
              disabled={register.isPending}
              className="btn-primary w-full justify-center"
            >
              {register.isPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <button
              onClick={onLogin}
              className="text-brand-600 hover:text-brand-700 font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
