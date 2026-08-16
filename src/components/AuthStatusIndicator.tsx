"use client";

import { useAuth } from "@/components/auth-provider";
import { Card } from "@/components/ui/Card";

export function AuthStatusIndicator() {
  const { session } = useAuth();
  
  if (!session) {
    return (
      <Card className="bg-amber-500/10 border border-amber-500/20 p-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-full bg-amber-500/20 border border-amber-500/30">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <div className="text-amber-100 font-medium text-sm">Not Authenticated</div>
            <div className="text-amber-200 text-xs">Connect your wallet to access your account</div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-emerald-500/10 border border-emerald-500/20 p-4">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-emerald-100 font-medium text-sm truncate">
            {truncateAddress(session.address)}
          </div>
          <div className="text-emerald-200 text-xs">
            Authenticated • {formatTimeAgo(session.authenticatedAt)}
          </div>
        </div>
      </div>
    </Card>
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}