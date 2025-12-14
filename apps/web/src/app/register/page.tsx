'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/use-auth-store';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import Balancer from 'react-wrap-balancer';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to create account');
      }

      login(json.user, json.accessToken);
      toast.success('Account created successfully!');
      router.push('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center container mx-auto px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold text-white mb-2">
            <Balancer>Create an Account</Balancer>
          </h1>
          <p className="text-gray-400">
            Get API access and start protecting your users
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-[#1F242F] border border-white/5 p-8 rounded-2xl space-y-6 shadow-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-wisesama-purple/50 focus:border-wisesama-purple/50 outline-none transition-all"
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  {...register('password')}
                  type="password"
                  placeholder="At least 8 characters"
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-wisesama-purple/50 focus:border-wisesama-purple/50 outline-none transition-all"
                />
              </div>
              {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
            </div>
          </div>

          <div className="flex items-start gap-2 bg-wisesama-purple/10 border border-wisesama-purple/20 p-3 rounded-lg">
            <ShieldCheck className="h-5 w-5 text-wisesama-purple-light shrink-0" />
            <p className="text-xs text-wisesama-purple-light">
              By signing up, you agree to our <Link href="/terms-of-service" className="underline hover:text-white">Terms</Link> and <Link href="/privacy-policy" className="underline hover:text-white">Privacy Policy</Link>.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-wisesama-purple to-wisesama-purple-accent text-white font-bold py-3.5 rounded-xl shadow-lg shadow-wisesama-purple/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Create Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-wisesama-purple-light hover:text-white font-medium transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
