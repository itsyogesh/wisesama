'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { identitiesApi, whitelistApi } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Copy,
  Shield,
  Twitter,
  Github,
  Globe,
  Mail,
  MessageSquare,
  Loader2,
  ExternalLink,
} from 'lucide-react';

const CATEGORIES = [
  'Exchange',
  'Validator',
  'Parachain',
  'DeFi',
  'Infrastructure',
  'Wallet',
  'DAO',
  'Other',
];

export default function IdentityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showWhitelistModal, setShowWhitelistModal] = useState(false);
  const [category, setCategory] = useState('Validator');
  const [description, setDescription] = useState('');
  const [whitelistTwitter, setWhitelistTwitter] = useState(true);
  const [whitelistDomain, setWhitelistDomain] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['identity', id],
    queryFn: () => identitiesApi.getById(id),
  });

  const identity = data?.data || data;

  // Check if already whitelisted
  const { data: whitelistCheck } = useQuery({
    queryKey: ['whitelist-check', identity?.address],
    queryFn: () =>
      whitelistApi.getAll({ search: identity?.address, limit: 1 }),
    enabled: !!identity?.address,
  });

  const isWhitelisted =
    (whitelistCheck?.data?.entities?.length || 0) > 0;

  const handleAddToWhitelist = async () => {
    if (!identity) return;
    setSubmitting(true);

    const results: string[] = [];
    const errors: string[] = [];

    // 1. Create address whitelist entry
    try {
      await whitelistApi.create({
        entityType: 'ADDRESS',
        value: identity.address,
        name: identity.displayName || identity.address,
        category,
        description: description || undefined,
        website: identity.web || undefined,
        twitter: identity.twitter || undefined,
      });
      results.push('Address');
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 409) {
        errors.push('Address already whitelisted');
      } else {
        errors.push('Failed to whitelist address');
      }
    }

    // 2. Optionally whitelist twitter
    if (whitelistTwitter && identity.twitter) {
      try {
        await whitelistApi.create({
          entityType: 'TWITTER',
          value: identity.twitter,
          name: identity.displayName || identity.twitter,
          category,
        });
        results.push(`Twitter @${identity.twitter}`);
      } catch (err: unknown) {
        const error = err as { response?: { status?: number } };
        if (error.response?.status === 409) {
          errors.push(`Twitter @${identity.twitter} already whitelisted`);
        } else {
          errors.push(`Failed to whitelist Twitter`);
        }
      }
    }

    // 3. Optionally whitelist domain
    if (whitelistDomain && identity.web) {
      try {
        await whitelistApi.create({
          entityType: 'DOMAIN',
          value: identity.web,
          name: identity.displayName || identity.web,
          category,
        });
        results.push(`Domain ${identity.web}`);
      } catch (err: unknown) {
        const error = err as { response?: { status?: number } };
        if (error.response?.status === 409) {
          errors.push(`Domain ${identity.web} already whitelisted`);
        } else {
          errors.push(`Failed to whitelist domain`);
        }
      }
    }

    setSubmitting(false);
    setShowWhitelistModal(false);

    if (results.length > 0) {
      toast.success(`Whitelisted: ${results.join(', ')}${errors.length > 0 ? ` (${errors.join(', ')})` : ''}`);
    } else if (errors.length > 0) {
      toast.error(errors.join(', '));
    }

    queryClient.invalidateQueries({ queryKey: ['whitelist'] });
    queryClient.invalidateQueries({ queryKey: ['whitelist-check'] });
  };

  const copyAddress = () => {
    if (identity?.address) {
      navigator.clipboard.writeText(identity.address);
      toast.success('Address copied');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-wisesama-purple" />
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-white/60">Identity not found</p>
        <Button variant="outline" onClick={() => router.push('/identities')}>
          Back to Identities
        </Button>
      </div>
    );
  }

  const additionalFields = identity.additionalFields && typeof identity.additionalFields === 'object'
    ? Object.entries(identity.additionalFields as Record<string, string>).filter(([_, v]) => v)
    : [];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Identity Details"
        description={identity.displayName || identity.address}
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Back button */}
        <button
          onClick={() => router.push('/identities')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Identities</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Identity Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main info */}
            <div className="glass-card p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-heading font-bold text-white">
                    {identity.displayName || '(No display name)'}
                  </h2>
                  {identity.legalName && (
                    <p className="text-white/60 mt-1">{identity.legalName}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'status-badge',
                      identity.source === 'POLKADOT_PEOPLE'
                        ? 'bg-pink-500/20 text-pink-300'
                        : 'bg-gray-500/20 text-gray-300'
                    )}
                  >
                    {identity.source === 'POLKADOT_PEOPLE' ? 'Polkadot' : 'Kusama'}
                  </span>
                  {identity.isVerified ? (
                    <span className="status-badge bg-green-500/20 text-green-300">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Verified
                    </span>
                  ) : (
                    <span className="status-badge bg-white/10 text-white/50">
                      <XCircle className="w-3 h-3 mr-1" />
                      Unverified
                    </span>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="mb-6">
                <p className="text-xs text-white/50 mb-1">Address</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-white/80 font-mono break-all">
                    {identity.address}
                  </code>
                  <button onClick={copyAddress} className="text-white/40 hover:text-white transition-colors flex-shrink-0">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Judgements */}
              {identity.judgements && Array.isArray(identity.judgements) && identity.judgements.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-white/50 mb-2">Registrar Judgements</p>
                  <div className="flex flex-wrap gap-2">
                    {identity.judgements.map((j: { registrarId: number; judgement: string }, i: number) => (
                      <span
                        key={i}
                        className={cn(
                          'status-badge',
                          j.judgement === 'Reasonable' || j.judgement === 'KnownGood'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        )}
                      >
                        Registrar #{j.registrarId}: {j.judgement}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Social Links */}
              <div>
                <p className="text-xs text-white/50 mb-3">Social & Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {identity.twitter && (
                    <SocialRow icon={Twitter} label="Twitter" value={`@${identity.twitter}`} href={`https://x.com/${identity.twitter}`} color="text-blue-400" />
                  )}
                  {identity.github && (
                    <SocialRow icon={Github} label="GitHub" value={identity.github} href={`https://github.com/${identity.github}`} color="text-white/70" />
                  )}
                  {identity.web && (
                    <SocialRow icon={Globe} label="Website" value={identity.web} href={`https://${identity.web}`} color="text-wisesama-purple-light" />
                  )}
                  {identity.email && (
                    <SocialRow icon={Mail} label="Email" value={identity.email} color="text-yellow-400" />
                  )}
                  {identity.discord && (
                    <SocialRow icon={MessageSquare} label="Discord" value={identity.discord} color="text-indigo-400" />
                  )}
                  {identity.matrix && (
                    <SocialRow icon={MessageSquare} label="Matrix" value={identity.matrix} color="text-green-400" />
                  )}
                  {identity.riot && (
                    <SocialRow icon={MessageSquare} label="Riot" value={identity.riot} color="text-orange-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Additional Fields */}
            {additionalFields.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-heading font-semibold text-white mb-4">
                  Additional On-chain Fields
                </h3>
                <div className="space-y-2">
                  {additionalFields.map(([key, value]) => (
                    <div key={key} className="flex items-center gap-4 text-sm">
                      <span className="text-white/50 min-w-[100px]">{key}</span>
                      <span className="text-white/80 font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h3 className="text-lg font-heading font-semibold text-white mb-4">
                Actions
              </h3>

              {isWhitelisted ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-wisesama-status-safe">
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Already Whitelisted</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push('/whitelist')}
                  >
                    View in Whitelist
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => setShowWhitelistModal(true)}
                >
                  <Shield className="w-4 h-4" />
                  Add to Whitelist
                </Button>
              )}
            </div>

            <div className="glass-card p-6">
              <h3 className="text-sm font-heading font-semibold text-white/60 mb-3">
                Sync Info
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-white/50">Last Synced</p>
                  <p className="text-white">
                    {identity.lastSyncedAt
                      ? formatDateTime(identity.lastSyncedAt)
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">Source</p>
                  <p className="text-white">
                    {identity.source === 'POLKADOT_PEOPLE'
                      ? 'Polkadot People Chain'
                      : 'Kusama People Chain'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add to Whitelist Modal */}
      {showWhitelistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-lg mx-4 border border-white/10">
            <h3 className="text-lg font-heading font-semibold text-white mb-1">
              Add to Whitelist
            </h3>
            <p className="text-sm text-white/50 mb-6">
              Whitelist {identity.displayName || 'this identity'} and optionally linked social accounts
            </p>

            <div className="space-y-4">
              {/* Pre-populated info */}
              <div className="p-3 rounded-lg bg-white/5 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/50 w-16">Name</span>
                  <span className="text-white">{identity.displayName || identity.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/50 w-16">Address</span>
                  <span className="text-white/80 font-mono text-xs">{identity.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/50 w-16">Chain</span>
                  <span className="text-white">{identity.source === 'POLKADOT_PEOPLE' ? 'Polkadot' : 'Kusama'}</span>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-sm text-white/60 mb-1 block">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field w-full"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm text-white/60 mb-1 block">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Why is this entity trusted?"
                  className="input-field w-full h-20 resize-none"
                />
              </div>

              {/* Linked entities */}
              {(identity.twitter || identity.web) && (
                <div>
                  <p className="text-sm text-white/60 mb-2">Also whitelist linked accounts</p>
                  <div className="space-y-2">
                    {identity.twitter && (
                      <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whitelistTwitter}
                          onChange={(e) => setWhitelistTwitter(e.target.checked)}
                          className="accent-wisesama-purple"
                        />
                        <Twitter className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-white">@{identity.twitter}</span>
                      </label>
                    )}
                    {identity.web && (
                      <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whitelistDomain}
                          onChange={(e) => setWhitelistDomain(e.target.checked)}
                          className="accent-wisesama-purple"
                        />
                        <Globe className="w-4 h-4 text-wisesama-purple-light" />
                        <span className="text-sm text-white">{identity.web}</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowWhitelistModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleAddToWhitelist} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {submitting ? 'Adding...' : 'Add to Whitelist'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SocialRow({
  icon: Icon,
  label,
  value,
  href,
  color = 'text-white/60',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
      <Icon className={cn('w-4 h-4 flex-shrink-0', color)} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/40">{label}</p>
        <p className="text-sm text-white truncate">{value}</p>
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/30 hover:text-white transition-colors flex-shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}
