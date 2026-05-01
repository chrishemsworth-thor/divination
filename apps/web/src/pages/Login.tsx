import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';

type Props = {
  onSuccess: () => void;
  onRegister: () => void;
};

export default function Login({ onSuccess, onRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const login = useMutation({
    mutationFn: () => api.post('/api/auth/login', { email, password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    },
  });

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <span className="text-2xl font-bold text-brand-600">EdgeIQ</span>
        </div>
        <h2 className="text-center text-2xl font-semibold text-gray-900">Sign in to your account</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-xl border border-gray-200">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              login.mutate();
            }}
          >
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
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
                autoComplete="current-password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={login.isPending}
              className="btn-primary w-full justify-center"
            >
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            No account?{' '}
            <button
              onClick={onRegister}
              className="text-brand-600 hover:text-brand-700 font-medium"
            >
              Create one free
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
