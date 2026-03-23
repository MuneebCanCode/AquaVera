import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth';
import { WalletProvider } from '@/lib/wallet';
import './globals.css';

export const metadata: Metadata = {
  title: 'AquaVera — True Water. Verified on Hedera.',
  description:
    'Tokenized Water Stewardship Credit marketplace. Trade verified water credits, retire for NFT certificates, and generate compliance reports — all on Hedera.',
  keywords: ['water credits', 'WSC', 'Hedera', 'sustainability', 'ESG', 'water stewardship'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans">
        <AuthProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </AuthProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}
