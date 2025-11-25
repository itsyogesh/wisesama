import { AlertTriangle, CheckCircle, HelpCircle, XCircle, Shield, User, Clock } from 'lucide-react';
import type { CheckResponse } from '@wisesama/types';
import { RiskMeter } from './risk-meter';
import { RiskBadge } from './risk-badge';

interface ResultCardProps {
  result: CheckResponse;
}

export function ResultCard({ result }: ResultCardProps) {
  const { entity, entityType, chain, assessment, blacklist, whitelist, identity, lookAlike, stats } =
    result;

  return (
    <div className="space-y-6">
      {/* Main Result Card */}
      <div className="rounded-xl bg-wisesama-dark border border-border/40 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 rounded text-xs font-medium bg-wisesama-purple/10 text-wisesama-purple-light">
                  {entityType}
                </span>
                {chain && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
                    {chain}
                  </span>
                )}
              </div>
              <h2 className="font-heading text-xl font-semibold break-all">{entity}</h2>
            </div>
            <RiskBadge riskLevel={assessment.riskLevel} />
          </div>
        </div>

        {/* Risk Meter */}
        <div className="p-6 border-b border-border/40">
          <RiskMeter score={assessment.riskScore} riskLevel={assessment.riskLevel} />
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Blacklist Status */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Blacklist Status
            </h3>
            <div className="p-4 rounded-lg bg-wisesama-dark-secondary">
              {blacklist.found ? (
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-wisesama-status-fraud shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-wisesama-status-fraud">Found in blacklist</p>
                    {blacklist.source && (
                      <p className="text-sm text-muted-foreground">Source: {blacklist.source}</p>
                    )}
                    {blacklist.threatName && (
                      <p className="text-sm text-muted-foreground">Threat: {blacklist.threatName}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-wisesama-status-safe" />
                  <p className="text-muted-foreground">Not found in blacklist</p>
                </div>
              )}
            </div>
          </div>

          {/* Whitelist Status */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Whitelist Status
            </h3>
            <div className="p-4 rounded-lg bg-wisesama-dark-secondary">
              {whitelist.found ? (
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-wisesama-status-safe shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-wisesama-status-safe">Verified Entity</p>
                    {whitelist.name && (
                      <p className="text-sm text-muted-foreground">{whitelist.name}</p>
                    )}
                    {whitelist.category && (
                      <p className="text-sm text-muted-foreground capitalize">
                        {whitelist.category}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  <p className="text-muted-foreground">Not in whitelist</p>
                </div>
              )}
            </div>
          </div>

          {/* Identity */}
          {entityType === 'ADDRESS' && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                On-chain Identity
              </h3>
              <div className="p-4 rounded-lg bg-wisesama-dark-secondary">
                {identity.hasIdentity ? (
                  <div className="flex items-start gap-3">
                    {identity.isVerified ? (
                      <CheckCircle className="h-5 w-5 text-wisesama-status-safe shrink-0 mt-0.5" />
                    ) : (
                      <HelpCircle className="h-5 w-5 text-wisesama-status-caution shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium">
                        {identity.isVerified ? 'Verified Identity' : 'Unverified Identity'}
                      </p>
                      {identity.displayName && (
                        <p className="text-sm text-muted-foreground">{identity.displayName}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <HelpCircle className="h-5 w-5 text-muted-foreground" />
                    <p className="text-muted-foreground">No on-chain identity</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Statistics
            </h3>
            <div className="p-4 rounded-lg bg-wisesama-dark-secondary">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold">{stats.timesSearched}</p>
                  <p className="text-sm text-muted-foreground">Searches</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.userReports}</p>
                  <p className="text-sm text-muted-foreground">Reports</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Look-alike Warning */}
      {lookAlike?.isLookAlike && (
        <div className="rounded-xl bg-wisesama-status-caution/10 border border-wisesama-status-caution/40 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-wisesama-status-caution shrink-0 mt-0.5" />
            <div>
              <h3 className="font-heading font-semibold text-wisesama-status-caution mb-1">
                Possible Impersonation Detected
              </h3>
              <p className="text-muted-foreground">{lookAlike.warning}</p>
              {lookAlike.similarity && (
                <p className="text-sm text-muted-foreground mt-2">
                  Similarity: {Math.round(lookAlike.similarity * 100)}%
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
