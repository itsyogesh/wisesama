'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  FileWarning,
  Heart,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_BASE_URL = 'https://wisesama-api.vercel.app';

interface EndpointProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  response?: string;
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    POST: 'bg-green-500/20 text-green-400 border-green-500/30',
    PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <Badge variant="outline" className={`${colors[method]} font-mono text-xs px-3 py-1`}>
      {method}
    </Badge>
  );
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
      className="h-7 px-2 text-gray-400 hover:text-white"
      onClick={copy}
    >
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function Endpoint({ method, path, description, params, response }: EndpointProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fullUrl = `${API_BASE_URL}${path}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-gray-800 rounded-lg overflow-hidden mb-4"
    >
      <div
        className="flex items-center gap-4 px-4 py-3 bg-gray-800/50 cursor-pointer hover:bg-gray-800/70 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MethodBadge method={method} />
        <code className="text-white font-mono text-sm flex-1">{path}</code>
        <span className="text-gray-400 text-sm hidden md:block">{description}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {isOpen && (
        <div className="p-4 bg-gray-900/50 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-400 text-sm">Full URL:</span>
              <code className="text-purple-400 text-sm font-mono">{fullUrl}</code>
              <CopyButton text={fullUrl} />
            </div>
            <p className="text-gray-300 text-sm">{description}</p>
          </div>

          {params && params.length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-2">Parameters</h4>
              <div className="space-y-2">
                {params.map((param) => (
                  <div key={param.name} className="flex items-start gap-3 text-sm">
                    <code className="text-purple-400 font-mono">{param.name}</code>
                    <Badge variant="outline" className="text-xs">
                      {param.type}
                    </Badge>
                    {param.required && (
                      <Badge variant="outline" className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
                        required
                      </Badge>
                    )}
                    <span className="text-gray-400">{param.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {response && (
            <div>
              <h4 className="text-white font-medium mb-2">Example Response</h4>
              <pre className="bg-gray-950 rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-green-400">{response}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function DocsPage() {
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
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <h1 className="font-heading font-bold text-4xl text-white">
              Wisesama API Documentation
            </h1>
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              v1.0.0
            </Badge>
          </div>
          <p className="text-gray-400 text-lg max-w-3xl">
            Analyze suspicious wallet addresses, domains, and entities with our fraud detection API.
            Perfect for building secure applications in the Polkadot ecosystem.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <code className="bg-gray-800 text-purple-400 px-3 py-1 rounded text-sm font-mono">
              Base URL: {API_BASE_URL}
            </code>
            <CopyButton text={API_BASE_URL} />
          </div>
        </motion.div>

        {/* API Sections */}
        <Tabs defaultValue="check" className="space-y-8">
          <TabsList className="bg-gray-800/50 border border-gray-700">
            <TabsTrigger value="check" className="data-[state=active]:bg-purple-600">
              <Search className="h-4 w-4 mr-2" />
              Check
            </TabsTrigger>
            <TabsTrigger value="report" className="data-[state=active]:bg-purple-600">
              <FileWarning className="h-4 w-4 mr-2" />
              Report
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-purple-600">
              <BarChart3 className="h-4 w-4 mr-2" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="health" className="data-[state=active]:bg-purple-600">
              <Heart className="h-4 w-4 mr-2" />
              Health
            </TabsTrigger>
          </TabsList>

          {/* Check Endpoints */}
          <TabsContent value="check" className="space-y-4">
            <div className="mb-6">
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Check Endpoints</h2>
              <p className="text-gray-400">
                Query entities for fraud risk assessment. Supports addresses, domains, and social handles.
              </p>
            </div>

            <Endpoint
              method="GET"
              path="/api/v1/check/{entity}"
              description="Return the fraud detection analysis for an entity"
              params={[
                { name: 'entity', type: 'string', required: true, description: 'Address, domain, or social handle to check' },
              ]}
              response={`{
  "meta": {
    "requestId": "abc123",
    "timestamp": "2024-01-15T12:00:00Z"
  },
  "data": {
    "entity": "1abc...xyz",
    "entityType": "ADDRESS",
    "riskLevel": "SAFE",
    "riskScore": 0,
    "blacklist": { "isBlacklisted": false },
    "whitelist": { "isWhitelisted": true, "name": "Polkadot Treasury" },
    "assessment": {
      "level": "SAFE",
      "confidence": 95,
      "factors": []
    }
  }
}`}
            />
          </TabsContent>

          {/* Report Endpoints */}
          <TabsContent value="report" className="space-y-4">
            <div className="mb-6">
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Report Endpoints</h2>
              <p className="text-gray-400">
                Submit and retrieve fraud reports to help protect the ecosystem.
              </p>
            </div>

            <Endpoint
              method="POST"
              path="/api/v1/reports"
              description="Submit a new fraud report"
              params={[
                { name: 'value', type: 'string', required: true, description: 'Entity value (address, domain, etc.)' },
                { name: 'entityType', type: 'string', required: true, description: 'ADDRESS | DOMAIN | TWITTER | EMAIL' },
                { name: 'threatCategory', type: 'string', required: true, description: 'PHISHING | SCAM | RUG_PULL | OTHER' },
                { name: 'description', type: 'string', required: false, description: 'Additional details about the report' },
                { name: 'reporterEmail', type: 'string', required: false, description: 'Reporter email for confirmation' },
              ]}
              response={`{
  "id": "report_abc123",
  "status": "pending",
  "message": "Report submitted successfully"
}`}
            />

            <Endpoint
              method="GET"
              path="/api/v1/reports"
              description="List verified fraud reports"
              params={[
                { name: 'page', type: 'number', required: false, description: 'Page number (default: 1)' },
                { name: 'limit', type: 'number', required: false, description: 'Results per page (max: 100)' },
              ]}
              response={`{
  "reports": [
    {
      "id": "report_123",
      "reportedValue": "1abc...xyz",
      "entityType": "ADDRESS",
      "threatCategory": "PHISHING",
      "createdAt": "2024-01-15T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}`}
            />

            <Endpoint
              method="GET"
              path="/api/v1/reports/recent"
              description="Get recent verified reports"
              params={[
                { name: 'limit', type: 'number', required: false, description: 'Number of reports (max: 50)' },
              ]}
              response={`{
  "reports": [
    {
      "id": "report_123",
      "reportedValue": "1abc...xyz",
      "entityType": "ADDRESS",
      "threatCategory": "SCAM",
      "createdAt": "2024-01-15T12:00:00Z"
    }
  ]
}`}
            />
          </TabsContent>

          {/* Stats Endpoints */}
          <TabsContent value="stats" className="space-y-4">
            <div className="mb-6">
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Stats Endpoints</h2>
              <p className="text-gray-400">
                Retrieve platform statistics and metrics.
              </p>
            </div>

            <Endpoint
              method="GET"
              path="/api/v1/stats"
              description="Get platform statistics"
              response={`{
  "totalReports": 1500,
  "verifiedReports": 1200,
  "totalUsers": 5000,
  "totalSearches": 50000,
  "totalEntities": 53000,
  "flaggedAddresses": 48000
}`}
            />
          </TabsContent>

          {/* Health Endpoints */}
          <TabsContent value="health" className="space-y-4">
            <div className="mb-6">
              <h2 className="font-heading font-bold text-2xl text-white mb-2">Health Endpoints</h2>
              <p className="text-gray-400">
                Check API health and status.
              </p>
            </div>

            <Endpoint
              method="GET"
              path="/api/v1/health"
              description="Check if the API is running"
              response={`{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00Z",
  "version": "1.0.0"
}`}
            />
          </TabsContent>
        </Tabs>

        {/* Getting Started */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-8">
              <h2 className="font-heading font-bold text-2xl text-white mb-4">
                Getting Started
              </h2>
              <div className="space-y-4 text-gray-300">
                <p>
                  To use the Wisesama API, simply make HTTP requests to our endpoints. No API key
                  is required for basic queries, but rate limits apply.
                </p>
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Example request:</p>
                  <code className="text-green-400 text-sm">
                    curl {API_BASE_URL}/api/v1/check/1abc...xyz
                  </code>
                </div>
                <p>
                  For higher rate limits and additional features, contact us to get an API key.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </main>
    </div>
  );
}
