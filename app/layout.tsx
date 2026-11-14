import type { Metadata } from 'next';
import { Outfit, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TURN//TAKE — Competitive 2D Arcade Tic-Tac-Toe',
  description:
    'Play Classic 3x3 Tic-Tac-Toe or battle head-to-head in Clash minigames to earn board placements and 2-win streak bonuses.',
  openGraph: {
    title: 'TURN//TAKE — Competitive 2D Arcade Tic-Tac-Toe',
    description:
      'Play Classic 3x3 Tic-Tac-Toe or battle head-to-head in Clash minigames to earn board placements and 2-win streak bonuses.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TURN//TAKE — Competitive 2D Arcade Tic-Tac-Toe',
    description:
      'Play Classic 3x3 Tic-Tac-Toe or battle head-to-head in Clash minigames.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        data-state="title"
        className="min-h-screen bg-[#10141D] text-[#F4F4F0] antialiased selection:bg-[#43DDE6]/30 selection:text-[#F4F4F0]"
      >
        {children}
      </body>
    </html>
  );
}
