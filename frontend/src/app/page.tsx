'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Droplets,
  ClipboardCheck,
  ShieldCheck,
  Coins,
  ArrowRightLeft,
  Waves,
  Users,
  Building2,
  Leaf,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber, formatLiters } from '@/lib/utils';
import type { PlatformStats } from '@/types';

const steps = [
  {
    icon: ClipboardCheck,
    title: 'Register Project',
    description: 'Water conservation projects register with location, baseline data, and sensor configuration.',
  },
  {
    icon: ShieldCheck,
    title: 'Verify Data',
    description: 'Sensor readings are hashed, logged to HCS, and verified through Guardian MRV policies.',
  },
  {
    icon: Coins,
    title: 'Mint Credits',
    description: 'Verified water impact is converted to WSC tokens on Hedera Token Service. 1 WSC = 1,000 liters.',
  },
  {
    icon: ArrowRightLeft,
    title: 'Trade & Retire',
    description: 'Buy credits on the marketplace, retire them for NFT certificates, and generate compliance reports.',
  },
];

export default function LandingPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    api.get<PlatformStats>('/dashboard/stats/platform')
      .then((res) => {
        if (res.success && res.data) setStats(res.data);
      })
      .finally(() => setStatsLoading(false));
  }, []);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-deep-blue via-deep-blue to-teal-800 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Waves className="absolute top-20 left-10 h-64 w-64 text-teal-300" />
          <Waves className="absolute bottom-10 right-10 h-48 w-48 text-teal-300 rotate-180" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 py-24 md:py-32 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Droplets className="h-10 w-10 md:h-12 md:w-12 text-teal-300" />
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">AquaVera</h1>
          </div>
          <p className="text-xl md:text-2xl text-teal-100 mb-4">
            True Water. Verified on Hedera.
          </p>
          <p className="max-w-2xl mx-auto text-base md:text-lg text-white/70 mb-10">
            The global water credit gap leaves billions of liters of conservation impact unrecognized.
            AquaVera tokenizes verified water stewardship into tradeable credits on Hedera,
            connecting projects to corporate buyers with full on-chain transparency.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="btn-primary px-8 py-3 text-base rounded-lg"
            >
              Register Now
            </Link>
            <Link
              href="/explore"
              className="btn-outline border-white text-white hover:bg-white/10 px-8 py-3 text-base rounded-lg"
            >
              Explore AquaVera
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-light-gray">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal/10">
                  <step.icon className="h-8 w-8 text-teal" />
                </div>
                <div className="mb-2 text-xs font-bold text-teal uppercase tracking-wider">Step {i + 1}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Platform Stats */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Platform Impact</h2>
          {statsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-teal" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <StatBlock icon={Coins} value={formatNumber(stats.totalWscMinted)} label="WSC Minted" />
              <StatBlock icon={Droplets} value={formatLiters(stats.totalLitersVerified)} label="Liters Verified" />
              <StatBlock icon={Waves} value={formatNumber(stats.totalActiveProjects)} label="Active Projects" />
              <StatBlock icon={Building2} value={formatNumber(stats.totalCorporateBuyers)} label="Corporate Buyers" />
              <StatBlock icon={Leaf} value={formatNumber(stats.totalCreditsRetired)} label="Credits Retired" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <StatBlock icon={Coins} value="7,800" label="WSC Minted" />
              <StatBlock icon={Droplets} value="7.8M L" label="Liters Verified" />
              <StatBlock icon={Waves} value="3" label="Active Projects" />
              <StatBlock icon={Building2} value="2" label="Corporate Buyers" />
              <StatBlock icon={Leaf} value="450" label="Credits Retired" />
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-deep-blue text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to make water count?</h2>
          <p className="text-white/70 mb-8">
            Join the marketplace where every drop of conservation is verified, tokenized, and tradeable.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="btn-primary px-8 py-3 text-base rounded-lg">
              Get Started
            </Link>
            <Link href="/login" className="text-teal-300 hover:text-teal-200 font-medium">
              Already have an account? Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 text-gray-400 text-center text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Droplets className="h-4 w-4 text-teal" />
          <span className="font-semibold text-white">AquaVera</span>
        </div>
        <p>Built on Hedera Testnet</p>
        <p className="mt-1">
          <Users className="inline h-3 w-3 mr-1" />
          15% of every trade goes to local communities
        </p>
      </footer>
    </main>
  );
}

/** Parse a formatted stat string into a numeric target and its original display string.
 *  Examples: "7,800" → 7800, "7.8M L" → 7800000, "3" → 3 */
function parseStatValue(formatted: string): number {
  const clean = formatted.replace(/,/g, '');
  const mMatch = clean.match(/^([\d.]+)\s*M/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1_000_000);
  const kMatch = clean.match(/^([\d.]+)\s*k/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000);
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

/** Format a running count back into the same style as the final value.
 *  We detect the suffix pattern from the original string and apply it. */
function formatRunningValue(current: number, finalFormatted: string): string {
  if (/M\s*L/i.test(finalFormatted)) {
    return `${(current / 1_000_000).toFixed(1)}M L`;
  }
  if (/k\s*L/i.test(finalFormatted)) {
    return `${(current / 1_000).toFixed(1)}k L`;
  }
  return new Intl.NumberFormat('en-US').format(current);
}

function StatBlock({ icon: Icon, value, label }: { icon: React.ElementType; value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState('0');
  const hasAnimated = useRef(false);

  const animate = useCallback(() => {
    const target = parseStatValue(value);
    if (target === 0) { setDisplay(value); return; }

    const duration = 2000;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      if (progress < 1) {
        setDisplay(formatRunningValue(current, value));
        requestAnimationFrame(tick);
      } else {
        setDisplay(value); // final formatted string exactly as provided
      }
    };

    requestAnimationFrame(tick);
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animate();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);

  return (
    <div ref={ref} className="text-center">
      <Icon className="h-6 w-6 text-teal mx-auto mb-2" />
      <p className="text-2xl font-bold text-gray-900">{display}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
