import { ExternalLink, CheckCircle, XCircle, HelpCircle, AlertTriangle } from 'lucide-react';
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
  const { entityType, chain, blacklist, whitelist, identity, lookAlike, virusTotal, links } = result;

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
          <div className="py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-300">On-chain Identity</p>
              {identity.hasIdentity && identity.displayName && (
                <p className="text-xs text-gray-500 mt-0.5">{identity.displayName}</p>
              )}
              {identity.hasIdentity && (
                <p className="text-xs text-gray-500">
                  {identity.isVerified ? 'Verified' : 'Not verified'}
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
      </div>
    </div>
  );
}
