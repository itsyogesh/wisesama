'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Key, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wisesama-api.vercel.app';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
  remainingQuota: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 px-2 text-gray-400 hover:text-white"
      onClick={copy}
    >
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function ApiKeyCard({ apiKey, onDelete }: { apiKey: ApiKey; onDelete: (id: string) => void }) {
  const [showKey, setShowKey] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700"
    >
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
          <Key className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{apiKey.name || 'Unnamed Key'}</span>
            <Badge variant="outline" className="text-xs">
              {apiKey.remainingQuota.toLocaleString()} requests left
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-sm text-gray-400 font-mono">
              {showKey ? `${apiKey.keyPrefix}...` : `${apiKey.keyPrefix}${'•'.repeat(24)}`}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <CopyButton text={apiKey.keyPrefix} />
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => onDelete(apiKey.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function GeneratedKeyModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="h-16 w-16 rounded-full bg-green-600/20 flex items-center justify-center mx-auto mb-4">
            <Key className="h-8 w-8 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">API Key Generated!</h3>
          <p className="text-gray-400 text-sm">
            Copy your API key now. You won&apos;t be able to see it again.
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <code className="text-green-400 font-mono text-sm break-all">{apiKey}</code>
            <CopyButton text={apiKey} />
          </div>
        </div>

        <Button className="w-full" onClick={onClose}>
          I&apos;ve Copied My Key
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default function DeveloperSettingsPage() {
  const [tokenName, setTokenName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isAuthenticated] = useState(false); // TODO: Replace with actual auth

  const handleGenerateToken = async () => {
    if (!tokenName.trim()) {
      toast.error('Please enter a token name');
      return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add auth header
        },
        body: JSON.stringify({ name: tokenName }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedKey(data.data?.key || data.key);
        toast.success('API key generated successfully!');
        setTokenName('');
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.message || 'Failed to generate API key');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys/${id}`, {
        method: 'DELETE',
        headers: {
          // TODO: Add auth header
        },
      });

      if (res.ok) {
        setApiKeys((prev) => prev.filter((key) => key.id !== id));
        toast.success('API key deleted');
      }
    } catch {
      toast.error('Failed to delete API key');
    }
  };

  return (
    <div
      className="min-h-screen bg-[#1A1A1A]"
      style={{
        backgroundImage: 'url(/newbg.png)',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    >
      <main className="py-20 lg:py-32">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="text-center">
              <h1 className="font-heading font-bold text-3xl lg:text-4xl text-white mb-4">
                Developer Settings
              </h1>
              <p className="text-gray-400">
                Manage your API keys and access tokens for the Wisesama API.
              </p>
            </div>

            {/* Generate Token Card */}
            <Card className="bg-gray-900/80 border-gray-800 backdrop-blur-sm">
              <CardContent className="p-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="font-heading font-bold text-xl text-white mb-2">
                      Generate API Token
                    </h2>
                    <p className="text-gray-400 text-sm">
                      Create a new API key to authenticate your requests.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-white font-medium">Token Name</label>
                      <Input
                        placeholder="e.g., Production API Key"
                        value={tokenName}
                        onChange={(e) => setTokenName(e.target.value)}
                        className="h-12 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500"
                      />
                    </div>

                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Button
                        onClick={handleGenerateToken}
                        disabled={!tokenName.trim() || isGenerating}
                        className="w-full h-12 bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 text-white font-bold disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Generating...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Key className="h-5 w-5" />
                            Generate Token
                          </div>
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              </CardContent>
            </Card>

            {/* Existing Keys */}
            {apiKeys.length > 0 && (
              <Card className="bg-gray-900/80 border-gray-800 backdrop-blur-sm">
                <CardContent className="p-8">
                  <h2 className="font-heading font-bold text-xl text-white mb-4">
                    Your API Keys
                  </h2>
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <ApiKeyCard key={key.id} apiKey={key} onDelete={handleDeleteKey} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info Card */}
            <Card className="bg-purple-900/20 border-purple-500/30">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-purple-600/20 flex items-center justify-center shrink-0">
                    <Key className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">API Key Security</h3>
                    <p className="text-gray-400 text-sm">
                      Keep your API keys secure and never share them publicly. Each key has a
                      rate limit of 60 requests per minute and 10,000 total requests. Contact us
                      if you need higher limits.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      {/* Generated Key Modal */}
      {generatedKey && (
        <GeneratedKeyModal apiKey={generatedKey} onClose={() => setGeneratedKey(null)} />
      )}
    </div>
  );
}
