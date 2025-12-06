'use client';

import { ExternalLink, CheckCircle, XCircle, HelpCircle, AlertTriangle, Twitter, Globe, MessageSquare, User, Copy, Link2, Calendar } from 'lucide-react';
import { useState } from 'react';
import type { CheckResponse, EntityType } from '@wisesama/types';

/**
 * Format a date as relative time (e.g., "2y 3mo ago")
 */
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  if (months > 0) {
    return `${years}y ${months}mo ago`;
  }
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Format a date as short date string (e.g., "Jan 15, 2023")
 */
function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface EntityDetailsCardProps {
  result: CheckResponse;
}

const entityTypeLabels: Record<EntityType, string> = {
  ADDRESS: 'Substrate Address', // Will be overridden with chain-specific label
  DOMAIN: 'Web Domain',
  TWITTER: 'Twitter Handle',
  EMAIL: 'Email Address',
};

/**
 * Get the display label for entity type, using chain name for addresses
 */
function getEntityTypeLabel(entityType: EntityType, chain?: string | null): string {
  if (entityType === 'ADDRESS' && chain) {
    // Capitalize chain name (e.g., "kusama" -> "Kusama Address")
    const chainName = chain.charAt(0).toUpperCase() + chain.slice(1);
    return `${chainName} Address`;
  }
  return entityTypeLabels[entityType];
}

function StatusBadge({ found, positive }: { found: boolean; positive?: boolean }) {
  if (found) {
    if (positive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
          <CheckCircle className="h-3.5 w-3.5" />
          Found
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
        <XCircle className="h-3.5 w-3.5" />
        Found
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
      <HelpCircle className="h-3.5 w-3.5" />
      Not Found
    </span>
  );
}

export function EntityDetailsCard({ result }: EntityDetailsCardProps) {
  const { entityType, chain, blacklist, whitelist, identity, lookAlike, virusTotal, links, linkedIdentities } = result;
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const getChainExplorerUrl = (address: string, chainName: string) => {
    if (chainName === 'polkadot') {
      return `https://polkadot.subscan.io/account/${address}`;
    } else if (chainName === 'kusama') {
      return `https://kusama.subscan.io/account/${address}`;
    }
    return null;
  };

  return (
    <div className="space-y-5">
      {/* Type and Chain - Compact inline badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Type</span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-wisesama-purple/20 text-wisesama-purple-light border border-wisesama-purple/30">
            {getEntityTypeLabel(entityType, chain)}
          </span>
        </div>
        {chain && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Chain</span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800/80 text-gray-200 border border-zinc-700/50 capitalize">
              {chain}
            </span>
          </div>
        )}
      </div>

      {/* Detail Rows */}
      <div className="space-y-3">
        {/* Blacklist Status */}
        <div className="group relative rounded-xl bg-zinc-800/30 border border-zinc-800/50 p-4 hover:border-zinc-700/50 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-200">Blacklist Search</p>
              <p className="text-xs text-gray-500">
                {blacklist.found
                  ? `Found in database${blacklist.source ? ` (${blacklist.source})` : ''}`
                  : 'Not found in any known blacklists'}
              </p>
              {blacklist.found && blacklist.threatName && (
                <p className="text-xs text-red-400/80">Threat: {blacklist.threatName}</p>
              )}
            </div>
            <StatusBadge found={blacklist.found} positive={false} />
          </div>
        </div>

        {/* Whitelist Status */}
        <div className="group relative rounded-xl bg-zinc-800/30 border border-zinc-800/50 p-4 hover:border-zinc-700/50 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-200">Whitelist Search</p>
              <p className="text-xs text-gray-500">
                {whitelist.found
                  ? `Verified: ${whitelist.name || 'Known entity'}${whitelist.category ? ` (${whitelist.category})` : ''}`
                  : 'Not found in verified whitelists'}
              </p>
            </div>
            <StatusBadge found={whitelist.found} positive={true} />
          </div>
        </div>

        {/* On-chain Identity (for addresses) */}
        {entityType === 'ADDRESS' && (
          <div className="py-4">
            {/* Identity Card */}
            <div className={`rounded-xl overflow-hidden ${
              identity.isVerified
                ? 'bg-gradient-to-br from-emerald-500/5 via-zinc-900 to-zinc-900 border border-emerald-500/20'
                : identity.hasIdentity
                  ? 'bg-gradient-to-br from-orange-500/5 via-zinc-900 to-zinc-900 border border-orange-500/20'
                  : 'bg-zinc-800/50 border border-zinc-700/50'
            }`}>
              {/* Card Header */}
              <div className="px-5 py-4 border-b border-zinc-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Identity Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      identity.isVerified
                        ? 'bg-emerald-500/10 ring-2 ring-emerald-500/30'
                        : identity.hasIdentity
                          ? 'bg-orange-500/10 ring-2 ring-orange-500/30'
                          : 'bg-zinc-700/50 ring-2 ring-zinc-600/30'
                    }`}>
                      {identity.isVerified ? (
                        <CheckCircle className="h-5 w-5 text-emerald-400" />
                      ) : identity.hasIdentity ? (
                        <AlertTriangle className="h-5 w-5 text-orange-400" />
                      ) : (
                        <User className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">On-chain Identity</h4>
                      {identity.hasIdentity && identity.displayName && (
                        <p className="text-lg font-semibold text-white mt-0.5">{identity.displayName}</p>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    identity.isVerified
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : identity.hasIdentity
                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                        : 'bg-zinc-700/50 text-gray-400 border border-zinc-600/50'
                  }`}>
                    {identity.isVerified ? (
                      <><CheckCircle className="h-4 w-4" /> Verified</>
                    ) : identity.hasIdentity ? (
                      <><AlertTriangle className="h-4 w-4" /> Unverified</>
                    ) : (
                      <><HelpCircle className="h-4 w-4" /> No Identity</>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              {identity.hasIdentity && (
                <div className="px-5 py-4 space-y-4">
                  {/* Verification Info */}
                  <p className="text-sm text-gray-400">
                    {identity.isVerified
                      ? 'This identity has been verified by a Polkadot registrar.'
                      : 'This identity has not been verified by a registrar.'}
                  </p>

                  {/* Timeline Section */}
                  {identity.timeline && (identity.timeline.identitySetAt || identity.timeline.firstVerifiedAt) && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Timeline</h5>
                      <div className="relative pl-4 border-l-2 border-zinc-700/50 space-y-4">
                        {identity.timeline.identitySetAt && (
                          <div className="relative">
                            {/* Timeline dot */}
                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-zinc-800 border-2 border-wisesama-purple" />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-wisesama-purple-light" />
                                <span className="text-sm font-medium text-white">Identity Created</span>
                              </div>
                              <p className="text-sm text-gray-400">
                                {formatShortDate(identity.timeline.identitySetAt)}
                                <span className="text-gray-500 ml-2">({formatRelativeTime(identity.timeline.identitySetAt)})</span>
                              </p>
                              {identity.timeline.isMigrated && (
                                <p className="text-xs text-amber-400/70 flex items-center gap-1.5 mt-1">
                                  <span className="w-1 h-1 rounded-full bg-amber-400/70" />
                                  Migrated from {identity.timeline.source === 'relay_chain' ? 'Relay Chain' : 'People Chain'}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {identity.timeline.firstVerifiedAt && (
                          <div className="relative">
                            {/* Timeline dot */}
                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-zinc-800 border-2 border-emerald-500" />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-sm font-medium text-white">Verified by Registrar</span>
                              </div>
                              <p className="text-sm text-gray-400">
                                {formatShortDate(identity.timeline.firstVerifiedAt)}
                                <span className="text-gray-500 ml-2">({formatRelativeTime(identity.timeline.firstVerifiedAt)})</span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Social Links */}
                  {(identity.twitter || identity.web || identity.riot) && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Connected Accounts</h5>
                      <div className="flex flex-wrap gap-2">
                        {identity.twitter && (
                          <a
                            href={`https://twitter.com/${identity.twitter.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800/80 text-gray-200 hover:bg-zinc-700 hover:text-white transition-all border border-zinc-700/50 hover:border-zinc-600 group"
                          >
                            <Twitter className="h-4 w-4 text-[#1DA1F2] group-hover:scale-110 transition-transform" />
                            {identity.twitter}
                            <ExternalLink className="h-3 w-3 text-gray-500 group-hover:text-gray-400" />
                          </a>
                        )}
                        {identity.web && (
                          <a
                            href={identity.web.startsWith('http') ? identity.web : `https://${identity.web}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800/80 text-gray-200 hover:bg-zinc-700 hover:text-white transition-all border border-zinc-700/50 hover:border-zinc-600 group"
                          >
                            <Globe className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
                            {identity.web.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            <ExternalLink className="h-3 w-3 text-gray-500 group-hover:text-gray-400" />
                          </a>
                        )}
                        {identity.riot && (
                          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800/80 text-gray-200 border border-zinc-700/50">
                            <MessageSquare className="h-4 w-4 text-green-400" />
                            {identity.riot}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No Identity State */}
              {!identity.hasIdentity && (
                <div className="px-5 py-4">
                  <p className="text-sm text-gray-500">
                    This address has no on-chain identity set. On-chain identities help establish trust and accountability.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction Tracing Graph */}
        {entityType === 'ADDRESS' && (
          <div className="group relative rounded-xl bg-zinc-800/30 border border-zinc-800/50 p-4 hover:border-zinc-700/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-200">Transaction Graph Analysis</p>
                <p className="text-xs text-gray-500">Not found in transaction tracing graph</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-700/50 text-gray-400 border border-zinc-600/30">
                <HelpCircle className="h-3.5 w-3.5" />
                N/A
              </span>
            </div>
          </div>
        )}

        {/* VirusTotal (for domains) */}
        {entityType === 'DOMAIN' && (
          <div className="py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-300">Phishing and Malware Assessment</p>
              {virusTotal ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  {virusTotal.positives}/{virusTotal.total} engines detected threats
                  {virusTotal.topEngines && virusTotal.topEngines.length > 0 && (
                    <span> ({virusTotal.topEngines.slice(0, 3).join(', ')})</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-0.5">VirusTotal scan not available</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {virusTotal && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  virusTotal.verdict === 'clean' ? 'bg-green-500/10 text-green-400' :
                  virusTotal.verdict === 'malicious' ? 'bg-red-500/10 text-red-400' :
                  virusTotal.verdict === 'suspicious' ? 'bg-orange-500/10 text-orange-400' :
                  'bg-gray-500/10 text-gray-400'
                }`}>
                  {virusTotal.verdict === 'clean' && <CheckCircle className="h-3.5 w-3.5" />}
                  {virusTotal.verdict === 'malicious' && <XCircle className="h-3.5 w-3.5" />}
                  {virusTotal.verdict === 'suspicious' && <AlertTriangle className="h-3.5 w-3.5" />}
                  {virusTotal.verdict === 'unknown' && <HelpCircle className="h-3.5 w-3.5" />}
                  <span className="capitalize">{virusTotal.verdict}</span>
                </span>
              )}
              {links?.virusTotal && (
                <a
                  href={links.virusTotal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-600/80 text-white hover:bg-purple-600 transition-colors"
                >
                  View on VirusTotal
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Look-alike Assessment (for Twitter) */}
        {entityType === 'TWITTER' && (
          <div className={`group relative rounded-xl p-4 transition-colors ${
            lookAlike?.isLookAlike
              ? 'bg-gradient-to-br from-orange-500/10 via-zinc-900/50 to-zinc-900/50 border border-orange-500/30'
              : 'bg-zinc-800/30 border border-zinc-800/50 hover:border-zinc-700/50'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  {lookAlike?.isLookAlike && (
                    <AlertTriangle className="h-4 w-4 text-orange-400" />
                  )}
                  <p className="text-sm font-medium text-gray-200">Look-alike Assessment</p>
                </div>

                {lookAlike?.isLookAlike ? (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400">{lookAlike.warning}</p>

                    {/* Handle Comparison */}
                    {lookAlike.knownHandle && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                        {/* Suspected Handle */}
                        <div className="flex-1 text-center">
                          <p className="text-[10px] text-orange-400/70 uppercase tracking-wider mb-1">Searched</p>
                          <div className="flex items-center justify-center gap-1.5">
                            <Twitter className="h-3.5 w-3.5 text-orange-400" />
                            <span className="text-sm font-mono text-orange-300">{result.entity}</span>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex flex-col items-center gap-0.5 text-gray-600">
                          <span className="text-[10px] uppercase tracking-wider">vs</span>
                        </div>

                        {/* Known Handle */}
                        <div className="flex-1 text-center">
                          <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-1">Original</p>
                          <a
                            href={`https://twitter.com/${lookAlike.knownHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity"
                          >
                            <Twitter className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-sm font-mono text-emerald-300">@{lookAlike.knownHandle}</span>
                            <ExternalLink className="h-3 w-3 text-gray-500" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No look-alike patterns detected</p>
                )}
              </div>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 ${
                lookAlike?.isLookAlike
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-zinc-700/50 text-gray-400 border border-zinc-600/30'
              }`}>
                {lookAlike?.isLookAlike ? (
                  <><AlertTriangle className="h-3.5 w-3.5" /> Warning</>
                ) : (
                  <><CheckCircle className="h-3.5 w-3.5" /> Clean</>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Linked On-Chain Identities (for Twitter and Domain) */}
        {(entityType === 'TWITTER' || entityType === 'DOMAIN') && linkedIdentities && (
          <div className="py-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm text-gray-300">Linked On-Chain Identities</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {linkedIdentities.found
                    ? `${linkedIdentities.count} ${linkedIdentities.count === 1 ? 'identity' : 'identities'} found${linkedIdentities.hasMore ? ' (showing first 10)' : ''}`
                    : 'No linked identities found'}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                linkedIdentities.found
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-gray-500/10 text-gray-400'
              }`}>
                <Link2 className="h-3.5 w-3.5" />
                {linkedIdentities.count} Linked
              </span>
            </div>

            {linkedIdentities.found && linkedIdentities.identities.length > 0 && (
              <div className="space-y-2">
                {linkedIdentities.identities.map((identity, idx) => {
                  const explorerUrl = getChainExplorerUrl(identity.address, identity.chain);
                  return (
                    <div
                      key={`${identity.address}-${identity.source}-${idx}`}
                      className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-white truncate">
                              {identity.displayName || 'Anonymous'}
                            </span>
                            {identity.isVerified && (
                              <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <code className="text-gray-400 font-mono">
                              {truncateAddress(identity.address)}
                            </code>
                            <button
                              onClick={() => copyAddress(identity.address)}
                              className="p-1 hover:bg-zinc-700 rounded transition-colors"
                              title="Copy address"
                            >
                              <Copy className={`h-3 w-3 ${copiedAddress === identity.address ? 'text-green-400' : 'text-gray-500'}`} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            identity.chain === 'polkadot'
                              ? 'bg-pink-500/20 text-pink-400'
                              : identity.chain === 'kusama'
                                ? 'bg-gray-500/20 text-gray-300'
                                : 'bg-zinc-600/20 text-zinc-400'
                          }`}>
                            {identity.chain}
                          </span>
                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
                              title="View on Subscan"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-gray-300" />
                            </a>
                          )}
                        </div>
                      </div>
                      {identity.judgements && identity.judgements.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {identity.judgements.map((j, jIdx) => (
                            <span
                              key={jIdx}
                              className={`px-1.5 py-0.5 rounded text-xs ${
                                ['Reasonable', 'KnownGood'].includes(j.judgement)
                                  ? 'bg-green-500/10 text-green-400'
                                  : 'bg-gray-500/10 text-gray-400'
                              }`}
                            >
                              {j.judgement}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
