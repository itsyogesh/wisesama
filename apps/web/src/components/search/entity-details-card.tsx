import { ExternalLink, CheckCircle, XCircle, HelpCircle, AlertTriangle, Twitter, Globe, MessageSquare, User, Copy, Link2 } from 'lucide-react';
import { useState } from 'react';
import type { CheckResponse, EntityType } from '@wisesama/types';

interface EntityDetailsCardProps {
  result: CheckResponse;
}

const entityTypeLabels: Record<EntityType, string> = {
  ADDRESS: 'Polkadot Address',
  DOMAIN: 'Web Domain',
  TWITTER: 'Twitter Handle',
  EMAIL: 'Email Address',
};

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
    <div className="space-y-4">
      {/* Type and Chain */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Type</p>
          <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-purple-600/80 text-white">
            {entityTypeLabels[entityType]}
          </span>
        </div>
        {chain && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Chain</p>
            <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-zinc-700 text-gray-200 capitalize">
              {chain}
            </span>
          </div>
        )}
      </div>

      {/* Detail Rows */}
      <div className="divide-y divide-zinc-800">
        {/* Blacklist Status */}
        <div className="py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-300">Blacklist Search Results</p>
            {blacklist.found && blacklist.source && (
              <p className="text-xs text-gray-500 mt-0.5">Source: {blacklist.source}</p>
            )}
            {blacklist.found && blacklist.threatName && (
              <p className="text-xs text-gray-500">Category: {blacklist.threatName}</p>
            )}
          </div>
          <StatusBadge found={blacklist.found} positive={false} />
        </div>

        {/* Whitelist Status */}
        <div className="py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-300">Whitelist Search Result</p>
            {whitelist.found && whitelist.name && (
              <p className="text-xs text-gray-500 mt-0.5">{whitelist.name}</p>
            )}
            {whitelist.found && whitelist.category && (
              <p className="text-xs text-gray-500 capitalize">{whitelist.category}</p>
            )}
          </div>
          <StatusBadge found={whitelist.found} positive={true} />
        </div>

        {/* On-chain Identity (for addresses) */}
        {entityType === 'ADDRESS' && (
          <div className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-300">On-chain Identity</p>
                {identity.hasIdentity && identity.displayName && (
                  <p className="text-sm font-medium text-white mt-1">{identity.displayName}</p>
                )}
                {identity.hasIdentity && (
                  <p className="text-xs text-gray-500">
                    {identity.isVerified ? 'Verified by registrar' : 'Not verified'}
                  </p>
                )}
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                identity.isVerified
                  ? 'bg-green-500/10 text-green-400'
                  : identity.hasIdentity
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'bg-gray-500/10 text-gray-400'
              }`}>
                {identity.isVerified ? (
                  <><CheckCircle className="h-3.5 w-3.5" /> Verified</>
                ) : identity.hasIdentity ? (
                  <><AlertTriangle className="h-3.5 w-3.5" /> Unverified</>
                ) : (
                  <><HelpCircle className="h-3.5 w-3.5" /> No Identity</>
                )}
              </span>
            </div>

            {/* Social Links */}
            {identity.hasIdentity && (identity.twitter || identity.web || identity.riot) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {identity.twitter && (
                  <a
                    href={`https://twitter.com/${identity.twitter.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-gray-300 hover:bg-zinc-700 transition-colors"
                  >
                    <Twitter className="h-3.5 w-3.5" />
                    {identity.twitter}
                  </a>
                )}
                {identity.web && (
                  <a
                    href={identity.web.startsWith('http') ? identity.web : `https://${identity.web}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-gray-300 hover:bg-zinc-700 transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {identity.web}
                  </a>
                )}
                {identity.riot && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-gray-300">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {identity.riot}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Transaction Tracing Graph */}
        {entityType === 'ADDRESS' && (
          <div className="py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-300">Transaction Tracing Graph Analysis</p>
              <p className="text-xs text-gray-500 mt-0.5">Not found in transaction tracing graph</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
              <HelpCircle className="h-3.5 w-3.5" />
              N/A
            </span>
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
          <div className="py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-300">Look-alike Assessment</p>
              {lookAlike?.isLookAlike ? (
                <>
                  <p className="text-xs text-orange-400 mt-0.5">{lookAlike.warning}</p>
                  {lookAlike.knownHandle && (
                    <p className="text-xs text-gray-500">
                      Possibly impersonating: @{lookAlike.knownHandle}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-500 mt-0.5">Not Applicable</p>
              )}
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              lookAlike?.isLookAlike
                ? 'bg-orange-500/10 text-orange-400'
                : 'bg-gray-500/10 text-gray-400'
            }`}>
              {lookAlike?.isLookAlike ? (
                <><AlertTriangle className="h-3.5 w-3.5" /> Warning</>
              ) : (
                <><CheckCircle className="h-3.5 w-3.5" /> Clean</>
              )}
            </span>
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
