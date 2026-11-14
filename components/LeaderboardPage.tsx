'use client';
import { useRouter } from 'next/navigation';
import { LeaderboardModal } from './LeaderboardModal';
import { useLeaderboard } from '@/hooks/use-leaderboard';
export function LeaderboardPage(){const router=useRouter();const board=useLeaderboard(true);return <main className="min-h-screen bg-[#10141D]"><LeaderboardModal entries={board.entries} loading={board.loading} error={board.error} mode={board.mode} onModeChange={board.setMode} onClose={()=>router.push('/')}/></main>;}
