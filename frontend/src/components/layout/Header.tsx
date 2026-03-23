'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Wallet, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWallet } from '@/lib/wallet';
import { truncateAddress } from '@/lib/wallet-utils';
import { toast } from 'sonner';

interface HeaderProps {
  unreadCount?: number;
}

const titleMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Water Projects',
  '/projects/register': 'Register Project',
  '/marketplace': 'Marketplace',
  '/retire': 'Retire Credits',
  '/certificates': 'Certificates',
  '/reports': 'Compliance Reports',
  '/community': 'Community Impact',
  '/notifications': 'Notifications',
};

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];

  let path = '';
  for (const seg of segments) {
    path += `/${seg}`;
    const label = titleMap[path] || seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({ label, href: path });
  }

  // Last crumb has no link
  if (crumbs.length > 0) {
    delete crumbs[crumbs.length - 1].href;
  }

  return crumbs;
}

export function Header({ unreadCount = 0 }: HeaderProps) {
  const pathname = usePathname();
  const wallet = useWallet();
  const [associating, setAssociating] = useState(false);
  const title = titleMap[pathname] || 'AquaVera';
  const breadcrumbs = getBreadcrumbs(pathname);

  async function handleConnect() {
    const result = await wallet.connect();
    if ('error' in result) {
      toast.error(result.error);
    } else {
      toast.success('Wallet connected!');
    }
  }

  async function handleAssociateToken() {
    const wscTokenId = process.env.NEXT_PUBLIC_WSC_TOKEN_ID || '0.0.8221664';
    setAssociating(true);
    const result = await wallet.associateToken(wscTokenId);
    setAssociating(false);
    if ('error' in result) {
      toast.error(`Token association failed: ${result.error}`);
    } else {
      toast.success('WSC token associated with your wallet!');
    }
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {breadcrumbs.length > 1 && (
          <nav aria-label="Breadcrumb" className="mt-1">
            <ol className="flex items-center gap-1 text-sm text-gray-500">
              {breadcrumbs.map((crumb, i) => (
                <li key={i} className="flex items-center gap-1">
                  {i > 0 && <span>/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-teal">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-gray-900">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Wallet Status */}
        {wallet.isMetaMaskInstalled && (
          wallet.status === 'connected' && wallet.evmAddress ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-mono text-gray-700">Wallet Connected</span>
                <button
                  onClick={() => wallet.disconnect()}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1"
                >
                  ✕
                </button>
              </div>
              {!wallet.tokenAssociated && (
                <button
                  onClick={handleAssociateToken}
                  disabled={associating}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  <Link2 className="h-3 w-3" />
                  {associating ? 'Associating...' : 'Associate WSC'}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={wallet.status === 'connecting'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 hover:border-teal hover:text-teal transition-colors disabled:opacity-50"
            >
              <Wallet className="h-4 w-4" />
              {wallet.status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )
        )}

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className={cn(
              'absolute -top-0.5 -right-0.5 flex items-center justify-center',
              'h-5 min-w-[1.25rem] px-1 rounded-full bg-danger text-white text-xs font-bold'
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
