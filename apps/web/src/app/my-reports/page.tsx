'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { Copy, Check, FileWarning, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wisesama-api.vercel.app';

interface Report {
  id: string;
  reportedValue: string;
  entityType: string;
  threatCategory: string;
  description?: string;
  status: string;
  createdAt: string;
  reviewedAt?: string;
}

interface ReportsResponse {
  reports: Report[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function truncateAddress(address: string, start = 6, end = 6) {
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
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
      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
      onClick={copy}
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants = {
    pending: { className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Pending' },
    verified: { className: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Verified' },
    rejected: { className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Rejected' },
  } as const;

  type StatusKey = keyof typeof variants;
  const key = (status in variants ? status : 'pending') as StatusKey;
  const variant = variants[key];

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <Image
        src="/images/empty-reports.webp"
        alt="No reports"
        width={200}
        height={200}
        className="mb-6 opacity-60"
      />
      <h3 className="text-xl font-semibold text-white mb-2">No reports yet</h3>
      <p className="text-gray-400 mb-6 max-w-md">
        You haven&apos;t submitted any fraud reports yet. Help protect the Polkadot ecosystem by
        reporting suspicious activities.
      </p>
      <Link href="/report">
        <Button variant="gradient">Submit a Report</Button>
      </Link>
    </motion.div>
  );
}

function LoginPrompt() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <FileWarning className="h-16 w-16 text-gray-500 mb-6" />
      <h3 className="text-xl font-semibold text-white mb-2">Login Required</h3>
      <p className="text-gray-400 mb-6 max-w-md">
        Please sign in to view your submitted reports.
      </p>
      <Button variant="gradient">Sign In</Button>
    </motion.div>
  );
}

export default function MyReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated] = useState(false); // TODO: Replace with actual auth state

  useEffect(() => {
    // TODO: Implement actual authentication check and fetch
    // For now, just show demo state
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <section
        className="min-h-screen bg-[#1A1A1A] py-12"
        style={{
          backgroundImage: 'url(/newbg.png)',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      >
        <div className="container mx-auto px-4 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      </section>
    );
  }

  return (
    <section
      className="min-h-screen bg-[#1A1A1A] py-12"
      style={{
        backgroundImage: 'url(/newbg.png)',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    >
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="font-heading font-bold text-3xl text-white">My Reports</h1>
          <p className="text-gray-400 text-sm mt-3">
            Checkout the addresses and entities you have reported
          </p>
        </motion.div>

        {!isAuthenticated ? (
          <LoginPrompt />
        ) : reports.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="overflow-hidden border border-gray-800 rounded-xl bg-[#1A1A1A]/80 backdrop-blur-sm"
          >
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-800 hover:bg-transparent">
                  <TableHead className="text-white font-heading font-medium text-base">
                    Address
                  </TableHead>
                  <TableHead className="text-white font-heading font-medium text-base">
                    Type
                  </TableHead>
                  <TableHead className="text-white font-heading font-medium text-base">
                    Category
                  </TableHead>
                  <TableHead className="text-white font-heading font-medium text-base">
                    Status
                  </TableHead>
                  <TableHead className="text-white font-heading font-medium text-base">
                    Reported
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report, index) => (
                  <motion.tr
                    key={report.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                  >
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 font-medium w-6">
                          {index + 1}.
                        </span>
                        <span className="text-white font-mono">
                          {truncateAddress(report.reportedValue)}
                        </span>
                        <CopyButton text={report.reportedValue} />
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-400 capitalize">
                      {report.entityType.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-gray-400 capitalize">
                      {report.threatCategory.toLowerCase().replace('_', ' ')}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={report.status} />
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {formatDate(report.createdAt)}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        )}
      </div>
    </section>
  );
}
