'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { whitelistApi } from '@/lib/api';
import { formatDateTime, truncateAddress } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Globe,
  Twitter,
  Pencil,
  Trash2,
  Save,
  X,
} from 'lucide-react';

export default function WhitelistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    website: '',
    twitter: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['whitelist-entity', params.id],
    queryFn: async () => {
      const response = await whitelistApi.getAll({ search: params.id as string });
      // Find the specific entity
      const entity = response.data?.items?.find((e: { id: string }) => e.id === params.id);
      if (entity) {
        setFormData({
          name: entity.name || '',
          category: entity.category || '',
          description: entity.description || '',
          website: entity.website || '',
          twitter: entity.twitter || '',
        });
      }
      return { data: entity };
    },
    enabled: !!params.id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      whitelistApi.update(params.id as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist-entity', params.id] });
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
      toast.success('Entity updated successfully');
      setIsEditing(false);
    },
    onError: () => {
      toast.error('Failed to update entity');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => whitelistApi.delete(params.id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
      toast.success('Entity deleted successfully');
      router.push('/whitelist');
    },
    onError: () => {
      toast.error('Failed to delete entity');
    },
  });

  const entity = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-wisesama-purple animate-spin" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-white/60">Entity not found</p>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="w-4 h-4" />
          Go back
        </Button>
      </div>
    );
  }

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Entity Details" />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Back button */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
            Back to whitelist
          </Button>

          {!isEditing && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="input-field w-full"
                    />
                  </div>
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
                    />
                  </div>
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
                    />
                  </div>
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
                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleSave} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Changes
                    </Button>
                    <Button variant="secondary" onClick={() => setIsEditing(false)}>
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-heading font-semibold text-white">
                        {entity.name}
                      </h2>
                      <p className="text-white/60 mt-1">{entity.category}</p>
                    </div>
                    <span className="status-badge bg-wisesama-purple/20 text-wisesama-purple-light">
                      {entity.entityType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <p className="text-sm text-white/60">Value</p>
                      <p className="font-mono text-white mt-1 break-all">
                        {entity.value}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-white/60">Chain</p>
                      <p className="text-white mt-1">
                        {entity.chain?.name || 'All chains'}
                      </p>
                    </div>
                    {entity.description && (
                      <div className="col-span-2">
                        <p className="text-sm text-white/60">Description</p>
                        <p className="text-white mt-1">{entity.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Links */}
                  <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-white/10">
                    {entity.website && (
                      <a
                        href={entity.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
                      >
                        <Globe className="w-4 h-4" />
                        Website
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {entity.twitter && (
                      <a
                        href={`https://twitter.com/${entity.twitter.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
                      >
                        <Twitter className="w-4 h-4" />
                        {entity.twitter}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h3 className="text-lg font-heading font-semibold text-white mb-4">
                Timeline
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-white/60">Created</p>
                  <p className="text-white">{formatDateTime(entity.createdAt)}</p>
                </div>
                <div>
                  <p className="text-white/60">Last Updated</p>
                  <p className="text-white">{formatDateTime(entity.updatedAt)}</p>
                </div>
              </div>
            </div>

            {entity.identity && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-heading font-semibold text-white mb-4">
                  On-chain Identity
                </h3>
                <div className="space-y-3 text-sm">
                  {entity.identity.displayName && (
                    <div>
                      <p className="text-white/60">Display Name</p>
                      <p className="text-white">{entity.identity.displayName}</p>
                    </div>
                  )}
                  {entity.identity.email && (
                    <div>
                      <p className="text-white/60">Email</p>
                      <p className="text-white">{entity.identity.email}</p>
                    </div>
                  )}
                  {entity.identity.web && (
                    <div>
                      <p className="text-white/60">Website</p>
                      <p className="text-white">{entity.identity.web}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-heading font-semibold text-white mb-4">
              Delete Entity
            </h3>
            <p className="text-white/60 mb-6">
              Are you sure you want to delete "{entity.name}"? This action cannot
              be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
