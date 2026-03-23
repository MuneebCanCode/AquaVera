'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  LayoutDashboard,
  Droplets,
  ShoppingCart,
  Leaf,
  Award,
  FileText,
  Users,
  Bell,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: Droplets },
  { href: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
  { href: '/retire', label: 'Retire Credits', icon: Leaf, roles: ['corporate_buyer'] },
  { href: '/certificates', label: 'Certificates', icon: Award, roles: ['corporate_buyer'] },
  { href: '/reports', label: 'Reports', icon: FileText, roles: ['corporate_buyer'] },
  { href: '/community', label: 'Community', icon: Users },
  { href: '/notifications', label: 'Notifications', icon: Bell },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = user?.role as UserRole | undefined;

  const visibleItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  return (
    <div className="lg:hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-deep-blue text-white">
        <div className="flex items-center gap-2">
          <Droplets className="h-6 w-6 text-teal" />
          <span className="text-lg font-bold">AquaVera</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg hover:bg-white/10"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Slide-out drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="fixed inset-y-0 left-0 z-50 w-72 bg-deep-blue text-white flex flex-col"
            aria-label="Mobile navigation"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Droplets className="h-6 w-6 text-teal" />
                <span className="text-lg font-bold">AquaVera</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {user && (
              <div className="border-t border-white/10 px-4 py-4">
                <p className="text-sm font-medium truncate">{user.full_name}</p>
                <p className="text-xs text-white/50 mb-3 truncate">{user.organization_name}</p>
                <button
                  onClick={() => { logout(); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
