'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { whitelistApi, apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';

interface Chain {
  id: number;
  name: string;
}

export default function NewWhitelistPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    entityType: 'ADDRESS',
    value: '',
    chainId: '',
    name: '',
    category: 'Exchange',
    description: '',
    website: '',
    twitter: '',
    logoUrl: '',
  });

  // Fetch chains
  const { data: chainsData } = useQuery({
    queryKey: ['chains'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/chains');
      return response.data;
    },
  });

  const chains: Chain[] = chainsData?.data || [];

  const createMutation = useMutation({
    mutationFn: () =>
      whitelistApi.create({
        entityType: formData.entityType,
        value: formData.value,
        chainId: formData.chainId ? parseInt(formData.chainId) : undefined,
        name: formData.name,
        category: formData.category,
        description: formData.description || undefined,
        website: formData.website || undefined,
        twitter: formData.twitter || undefined,
        logoUrl: formData.logoUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
      toast.success('Entity added to whitelist');
      router.push('/whitelist');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add entity');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.value || !formData.name) {
      toast.error('Please fill in required fields');
      return;
    }
    createMutation.mutate();
  };

  const categories = [
    'Exchange',
    'DeFi',
    'NFT',
    'DAO',
    'Bridge',
    'Wallet',
    'Infrastructure',
    'Gaming',
    'Social',
    'Other',
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Add to Whitelist" />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Back button */}
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
          Back to whitelist
        </Button>

        <form onSubmit={handleSubmit} className="max-w-2xl">
          <div className="glass-card p-6 space-y-6">
            <h2 className="text-lg font-heading font-semibold text-white">
              Entity Details
            </h2>

            {/* Type selection */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Entity Type *
              </label>
              <div className="flex gap-2">
                {['ADDRESS', 'DOMAIN', 'TWITTER'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, entityType: type })
                    }
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      formData.entityType === type
                        ? 'bg-wisesama-purple text-white'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Value */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                {formData.entityType === 'ADDRESS'
                  ? 'Wallet Address'
                  : formData.entityType === 'DOMAIN'
                  ? 'Domain'
                  : 'Twitter Handle'}{' '}
                *
              </label>
              <input
                type="text"
                value={formData.value}
                onChange={(e) =>
                  setFormData({ ...formData, value: e.target.value })
                }
                className="input-field w-full"
                placeholder={
                  formData.entityType === 'ADDRESS'
                    ? '5Grw...'
                    : formData.entityType === 'DOMAIN'
                    ? 'example.com'
                    : '@handle'
                }
              />
            </div>

            {/* Chain (only for addresses) */}
            {formData.entityType === 'ADDRESS' && (
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Chain (optional - leave empty for all chains)
                </label>
                <select
                  value={formData.chainId}
                  onChange={(e) =>
                    setFormData({ ...formData, chainId: e.target.value })
                  }
                  className="input-field w-full"
                >
                  <option value="">All chains</option>
                  {chains.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Display Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="input-field w-full"
                placeholder="e.g., Binance, Uniswap"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="input-field w-full"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="input-field w-full h-24 resize-none"
                placeholder="Brief description of this entity..."
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                className="input-field w-full"
                placeholder="https://..."
              />
            </div>

            {/* Twitter */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Twitter
              </label>
              <input
                type="text"
                value={formData.twitter}
                onChange={(e) =>
                  setFormData({ ...formData, twitter: e.target.value })
                }
                className="input-field w-full"
                placeholder="@handle"
              />
            </div>

            {/* Logo URL */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Logo URL
              </label>
              <input
                type="url"
                value={formData.logoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, logoUrl: e.target.value })
                }
                className="input-field w-full"
                placeholder="https://..."
              />
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-white/10">
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add to Whitelist
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
