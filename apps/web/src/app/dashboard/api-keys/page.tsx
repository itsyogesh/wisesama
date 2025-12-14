'use client';

import { useState } from 'react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/use-api-keys';
import { Loader2, Plus, Copy, Trash2, Check, Key } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ApiKeysPage() {
  const { data: keys, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    createKey.mutate(newKeyName, {
      onSuccess: (data) => {
        setCreatedKey(data.key);
        setNewKeyName('');
        toast.success('API Key created successfully');
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const handleRevoke = (id: string) => {
    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      revokeKey.mutate(id, {
        onSuccess: () => toast.success('API Key revoked'),
        onError: (error) => toast.error(error.message),
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white mb-2">API Keys</h1>
          <p className="text-gray-400">Manage your API keys for external access</p>
        </div>
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-wisesama-purple hover:bg-wisesama-purple-accent text-white"
          disabled={keys && keys.filter(k => k.isActive).length >= 5}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Key
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-wisesama-purple" />
        </div>
      ) : keys && keys.length > 0 ? (
        <div className="bg-[#1F242F] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-gray-400 text-sm bg-white/5">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Key Prefix</th>
                <th className="p-4 font-medium">Created</th>
                <th className="p-4 font-medium">Last Used</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-medium text-white">
                    {key.name || 'Unnamed Key'}
                  </td>
                  <td className="p-4 font-mono text-gray-400 text-sm">
                    {key.keyPrefix}...
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {format(new Date(key.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {key.lastUsedAt ? format(new Date(key.lastUsedAt), 'MMM d, yyyy') : 'Never'}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      key.isActive 
                        ? 'bg-green-500/10 text-green-400' 
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {key.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {key.isActive && (
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                        title="Revoke Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-20 bg-[#1F242F] border border-white/5 rounded-2xl">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-white font-medium text-lg mb-2">No API Keys Found</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create an API key to start integrating Wisesama into your applications.
          </p>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            variant="outline"
            className="border-wisesama-purple text-wisesama-purple-light hover:bg-wisesama-purple/10"
          >
            Create Your First Key
          </Button>
        </div>
      )}

      {/* Create Key Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        if (!open) {
          setCreatedKey(null); // Reset when closing
          setIsCreateOpen(false);
        }
      }}>
        <DialogContent className="bg-[#1F242F] border-white/10 text-white sm:max-w-md">
          {!createdKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Give your key a name to identify it later.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Key Name (Optional)</label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production App"
                  className="bg-black/20 border-white/10 text-white placeholder:text-gray-600"
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-white">
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={createKey.isPending}
                  className="bg-wisesama-purple hover:bg-wisesama-purple-accent text-white"
                >
                  {createKey.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Key'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-green-400 flex items-center gap-2">
                  <Check className="w-5 h-5" /> Key Created
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Copy this key now. You won&apos;t be able to see it again!
                </DialogDescription>
              </DialogHeader>
              <div className="py-6">
                <div className="relative">
                  <div className="w-full bg-black/40 border border-wisesama-purple/30 rounded-xl p-4 font-mono text-sm text-wisesama-purple-light break-all pr-12">
                    {createdKey}
                  </div>
                  <button
                    onClick={() => copyToClipboard(createdKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsCreateOpen(false)} className="w-full bg-wisesama-purple hover:bg-wisesama-purple-accent text-white">
                  I&apos;ve copied it
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
