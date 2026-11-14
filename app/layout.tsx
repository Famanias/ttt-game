import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const outfit=localFont({src:'../public/fonts/outfit.ttf',weight:'500 800',variable:'--font-outfit',display:'swap'});
const dmSans=localFont({src:'../public/fonts/dm-sans.ttf',weight:'400 700',variable:'--font-dm-sans',display:'swap'});
const jetbrainsMono=localFont({src:'../public/fonts/jetbrains-mono.ttf',weight:'500 700',variable:'--font-jetbrains-mono',display:'swap'});

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
