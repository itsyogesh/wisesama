'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useWhitelistRequest } from '@/hooks/use-whitelist-request';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';
import Balancer from 'react-wrap-balancer';

const schema = z.object({
  entityType: z.enum(['ADDRESS', 'DOMAIN', 'TWITTER']),
  value: z.string().min(1, 'Entity value is required'),
  chainCode: z.string().optional(),
  name: z.string().min(1, 'Project name is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  twitter: z.string().optional(),
  requesterName: z.string().min(1, 'Your name is required'),
  requesterEmail: z.string().email('Invalid email address'),
  requesterOrg: z.string().optional(),
  evidenceUrls: z.string().optional(), // Comma separated
  verificationNotes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function WhitelistRequestPage() {
  const { mutate, isPending } = useWhitelistRequest();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      entityType: 'ADDRESS',
      category: 'project',
    },
  });

  const entityType = watch('entityType');

  const onSubmit = (data: FormData) => {
    const evidenceUrls = data.evidenceUrls
      ? data.evidenceUrls.split(',').map((u: string) => u.trim()).filter(Boolean)
      : [];

    mutate(
      {
        ...data,
        evidenceUrls,
        website: data.website || undefined,
        chainCode: data.entityType === 'ADDRESS' ? (data.chainCode || 'dot') : undefined,
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          toast.success('Request submitted successfully!');
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
        <div className="bg-[#1F242F] border border-green-500/20 rounded-2xl p-12">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="font-heading text-3xl text-white mb-4">Request Submitted</h2>
          <p className="text-gray-400 text-lg leading-relaxed mb-8">
            Thank you for helping keep the ecosystem safe. Our team will review your whitelist request and verify the entity details. You will receive an email update once the review is complete.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-wisesama-purple-light hover:text-white font-medium"
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-wisesama-purple/10 border border-wisesama-purple/20 text-xs font-medium text-wisesama-purple-light uppercase tracking-wider mb-6">
          <ShieldCheck className="w-4 h-4" />
          <span>Verification</span>
        </div>
        <h1 className="font-heading text-4xl md:text-5xl font-semibold text-white mb-4">
          <Balancer>
            Whitelist <span className="text-transparent bg-clip-text bg-gradient-to-r from-wisesama-purple to-wisesama-purple-light">Request</span>
          </Balancer>
        </h1>
        <p className="text-gray-400 text-lg">
          <Balancer>
            Submit a project or entity for verification to be included in our trusted directory.
          </Balancer>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-[#1F242F] border border-white/5 p-8 rounded-2xl">
        {/* Entity Details */}
        <div className="space-y-6">
          <h3 className="text-xl font-heading text-white border-b border-white/10 pb-2">Entity Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Entity Type</label>
              <select
                {...register('entityType')}
                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
              >
                <option value="ADDRESS">Wallet Address</option>
                <option value="DOMAIN">Website Domain</option>
                <option value="TWITTER">Twitter Handle</option>
              </select>
            </div>

            {entityType === 'ADDRESS' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Chain</label>
                <select
                  {...register('chainCode')}
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
                >
                  <option value="dot">Polkadot</option>
                  <option value="ksm">Kusama</option>
                  <option value="astr">Astar</option>
                  <option value="glmr">Moonbeam</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              {entityType === 'ADDRESS' ? 'Wallet Address' : entityType === 'DOMAIN' ? 'Domain URL' : 'Twitter Handle'}
            </label>
            <input
              {...register('value')}
              placeholder={entityType === 'ADDRESS' ? '15oF4...' : entityType === 'DOMAIN' ? 'example.com' : '@handle'}
              className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
            />
            {errors.value && <p className="text-red-400 text-sm">{errors.value.message}</p>}
          </div>
        </div>

        {/* Project Info */}
        <div className="space-y-6">
          <h3 className="text-xl font-heading text-white border-b border-white/10 pb-2">Project Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Project Name</label>
              <input
                {...register('name')}
                placeholder="e.g. Polkadot Treasury"
                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
              />
              {errors.name && <p className="text-red-400 text-sm">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Category</label>
              <select
                {...register('category')}
                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
              >
                <option value="project">Project / DApp</option>
                <option value="validator">Validator</option>
                <option value="exchange">Exchange</option>
                <option value="wallet">Wallet Provider</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="foundation">Foundation / Official</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Brief description of the entity..."
              className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Official Website</label>
              <input
                {...register('website')}
                placeholder="https://..."
                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
              />
              {errors.website && <p className="text-red-400 text-sm">{errors.website.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Twitter URL</label>
              <input
                {...register('twitter')}
                placeholder="https://twitter.com/..."
                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Requester Info */}
        <div className="space-y-6">
          <h3 className="text-xl font-heading text-white border-b border-white/10 pb-2">Your Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Your Name</label>
              <input
                {...register('requesterName')}
                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
              />
              {errors.requesterName && <p className="text-red-400 text-sm">{errors.requesterName.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Email (for updates)</label>
              <input
                {...register('requesterEmail')}
                type="email"
                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
              />
              {errors.requesterEmail && <p className="text-red-400 text-sm">{errors.requesterEmail.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Organization (Optional)</label>
            <input
              {...register('requesterOrg')}
              className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Evidence URLs (Optional)</label>
            <input
              {...register('evidenceUrls')}
              placeholder="Comma separated URLs (e.g. tweets, forum posts)"
              className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-wisesama-purple/50 outline-none"
            />
            <p className="text-xs text-gray-500">Provide links that verify this entity belongs to the project.</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-gradient-to-r from-wisesama-purple to-wisesama-purple-accent text-white font-bold py-4 rounded-xl shadow-lg shadow-wisesama-purple/20 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Request'
          )}
        </button>
      </form>
    </div>
  );
}
