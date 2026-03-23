'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Droplets,
  ShoppingCart,
  Leaf,
  Award,
  FileText,
  Users,
  Bell,
  LogOut,
  Shield,
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

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = user?.role as UserRole | undefined;

  const visibleItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-deep-blue text-white">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-white/10">
        <Droplets className="h-7 w-7 text-teal" />
        <span className="text-xl font-bold tracking-tight">AquaVera</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
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
      </nav>

      {/* User profile + logout */}
      <div className="border-t border-white/10 px-4 py-4">
        {user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 h-9 w-9 rounded-full bg-teal/20 flex items-center justify-center">
              <Shield className="h-4 w-4 text-teal" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-white/50 truncate">{user.organization_name}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
