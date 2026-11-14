'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { soundEngine } from '@/lib/game/audio';
import {
  checkWinner,
  chooseBotMove,
  createEmptyBoard,
  generateBotClashScore,
  getAvailableMoves,
  pickNextMinigame,
  resolveClashRound,
} from '@/lib/game/rules';
import type {
  AvatarId,
  BoardState,
  BotDifficulty,
  GameMode,
  GameScreen,
  Mark,
  MinigameId,
  MinigameSelection,
  OpponentType,
  PlayerProfile,
  RoomState,
  StreakState,
} from '@/lib/game/types';
import { ArenaScreen } from './ArenaScreen';
import { ClashMinigameModal } from './ClashMinigameModal';
import { LeaderboardModal } from './LeaderboardModal';
import { LobbyScreen } from './LobbyScreen';
import { OutcomeModal } from './OutcomeModal';
import { WaitingRoomScreen } from './WaitingRoomScreen';
import { OnlineRoomView } from './OnlineRoomView';
import { onlineGame, ensureGuest } from '@/lib/services/online-game';
import { useLeaderboard } from '@/hooks/use-leaderboard';
import type { OnlineRoom } from '@/lib/online/contracts';

interface TurnTakeAppProps {
  initialAutostart?: boolean;
  initialRoomCode?: string | null;
}

const DEFAULT_BOT_PROFILE: PlayerProfile = {
  name: 'ARC-Bot',
  avatarId: 'cube-runner',
};

const DEFAULT_P2_PROFILE: PlayerProfile = {
  name: 'Player O',
  avatarId: 'shield-face',
};

export function TurnTakeApp({
  initialAutostart = false,
  initialRoomCode = null,
}: TurnTakeAppProps) {
  const [screen, setScreen] = useState<GameScreen>(
    initialAutostart ? 'playing' : 'title'
  );
  const [mode, setMode] = useState<GameMode>('classic');
  const [opponentType, setOpponentType] = useState<OpponentType>('bot');
  const [lobbyOpponent, setLobbyOpponent] =
    useState<Exclude<OpponentType, 'room'>>('bot');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('tactical');
  const [minigameSelection, setMinigameSelection] =
    useState<MinigameSelection>('rotating');

  const [playerName, setPlayerName] = useState('Player X');
  const [playerAvatar, setPlayerAvatar] = useState<AvatarId>('orb-bot');

  const [board, setBoard] = useState<BoardState>(createEmptyBoard);
  const [startingMark, setStartingMark] = useState<Mark>('X');
  const [currentTurn, setCurrentTurn] = useState<Mark>('X');
  const [winner, setWinner] = useState<Mark | 'draw' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [sessionScores, setSessionScores] = useState({ X: 0, O: 0, draws: 0 });

  // Clash state
  const [clashRound, setClashRound] = useState(1);
  const [clashStreaks, setClashStreaks] = useState<StreakState>({ X: 0, O: 0 });
  const [bestStreak, setBestStreak] = useState(0);
  const [pendingPlacements, setPendingPlacements] = useState(0);
  const [pendingPlacer, setPendingPlacer] = useState<Mark | null>(null);
  const [activeMinigame, setActiveMinigame] =
    useState<MinigameId>('perfect-timing');
  const [clashOpen, setClashOpen] = useState(false);
  const [clashXScore, setClashXScore] = useState<number | null>(null);
  const [clashOScore, setClashOScore] = useState<number | null>(null);
  const [lastClashSummary, setLastClashSummary] = useState<{
    round: number;
    minigame: MinigameId;
    xScore: number;
    oScore: number;
    winner: Mark | null;
    bonusTriggered: boolean;
  } | null>(null);

  const [onlineRoom,setOnlineRoom]=useState<OnlineRoom|null>(null);
  const [publicLeaderboard,setPublicLeaderboard]=useState(false);
  // Room multiplayer state
  const [room, setRoom] = useState<RoomState | null>(null);
  const [localRoomMark, setLocalRoomMark] = useState<Mark>('X');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);

  // UI & Audio state
  const [muted, setMuted] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const leaderboardState=useLeaderboard(leaderboardOpen);
  const leaderboardEntries=leaderboardState.entries;
  const leaderboardLoading=leaderboardState.loading;

  const recordedFinishRef = useRef(false);
  const boardRef = useRef<BoardState>(createEmptyBoard());

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const botThinking =
    screen === 'playing' &&
    opponentType === 'bot' &&
    winner === null &&
    ((mode === 'classic' && currentTurn === 'O') ||
      (mode === 'clash' &&
        !clashOpen &&
        pendingPlacer === 'O' &&
        pendingPlacements > 0));

  const playerX: PlayerProfile =
    opponentType === 'room' && room
      ? room.players.X
      : { name: playerName.trim() || 'Player X', avatarId: playerAvatar };

  const playerO: PlayerProfile =
    opponentType === 'room' && room && room.players.O
      ? room.players.O
      : opponentType === 'bot'
        ? DEFAULT_BOT_PROFILE
        : DEFAULT_P2_PROFILE;

  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  const fetchLeaderboard=leaderboardState.refresh;

  const resetMatchState = useCallback(
    (
      nextMode: GameMode,
      nextOpponent: OpponentType,
      starter: Mark = 'X',
      resetScores = false
    ) => {
      recordedFinishRef.current = false;
      const empty = createEmptyBoard();
      boardRef.current = empty;
      setMode(nextMode);
      setOpponentType(nextOpponent);
      setBoard(empty);
      setStartingMark(starter);
      setCurrentTurn(starter);
      setWinner(null);
      setWinningLine(null);
      setMoveCount(0);
      setClashRound(1);
      setClashStreaks({ X: 0, O: 0 });
      setPendingPlacements(0);
      setPendingPlacer(null);
      setActiveMinigame(pickNextMinigame(minigameSelection, 1));
      setClashXScore(null);
      setClashOScore(null);
      setLastClashSummary(null);
      setClashOpen(nextMode === 'clash');
      if (resetScores) {
        setSessionScores({ X: 0, O: 0, draws: 0 });
        setBestStreak(0);
      }
      if (nextMode === 'clash') {
        soundEngine.playClashStart();
      }
    },
    [minigameSelection]
  );

  const handleStartClassic = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setRoom(null);
    resetMatchState('classic', lobbyOpponent, 'X', true);
    setScreen('playing');
  }, [lobbyOpponent, resetMatchState]);

  const handleStartClash = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setRoom(null);
    resetMatchState('clash', lobbyOpponent, 'X', true);
    setScreen('playing');
  }, [lobbyOpponent, resetMatchState]);

  useEffect(() => {
    if (!initialRoomCode) return;
    let alive=true;
    ensureGuest().then(()=>onlineGame.snapshot(initialRoomCode.toUpperCase())).then(data=>{
      if(alive)setOnlineRoom(data.room);
    }).catch(()=>{});
    return ()=>{alive=false;};
  },[initialRoomCode]);

  const applyLocalCellPlacement = useCallback(
    (index: number, mark: Mark) => {
      const prevBoard = boardRef.current;
      if (prevBoard[index] !== null) return;

      const nextBoard = [...prevBoard];
      nextBoard[index] = mark;
      boardRef.current = nextBoard;
      setBoard(nextBoard);
      soundEngine.playPlaceMark(mark);

      const nextMoveCount = nextBoard.filter((c) => c !== null).length;
      setMoveCount(nextMoveCount);

      const result = checkWinner(nextBoard);

      if (result.winner) {
        setWinner(result.winner);
        setWinningLine(result.line);
        setPendingPlacements(0);
        setPendingPlacer(null);
        setSessionScores((scores) => ({
          X: scores.X + (result.winner === 'X' ? 1 : 0),
          O: scores.O + (result.winner === 'O' ? 1 : 0),
          draws: scores.draws + (result.winner === 'draw' ? 1 : 0),
        }));
        if (result.winner === 'draw') soundEngine.playDraw();
        else soundEngine.playVictory();
        setScreen('gameover');

      } else if (mode === 'classic') {
        setCurrentTurn(mark === 'X' ? 'O' : 'X');
      } else {
        const nextPending = Math.max(0, pendingPlacements - 1);
        setPendingPlacements(nextPending);
        if (nextPending === 0) {
          const nextRound = clashRound + 1;
          setPendingPlacer(null);
          setClashRound(nextRound);
          setActiveMinigame(pickNextMinigame(minigameSelection, nextRound));
          setClashXScore(null);
          setClashOScore(null);
          setLastClashSummary(null);
        }
      }
    },
    [
      mode,
      pendingPlacements,
      clashRound,
      minigameSelection,

    ]
  );

  // Bot turn automation in Classic Mode
  useEffect(() => {
    if (
      screen !== 'playing' ||
      mode !== 'classic' ||
      opponentType !== 'bot' ||
      currentTurn !== 'O' ||
      winner !== null
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const move = chooseBotMove(board, 'O', botDifficulty);
      if (move >= 0) {
        applyLocalCellPlacement(move, 'O');
      }
    }, 430);

    return () => clearTimeout(timer);
  }, [
    screen,
    mode,
    opponentType,
    currentTurn,
    winner,
    board,
    botDifficulty,
    applyLocalCellPlacement,
  ]);

  // Bot automatic placement in Clash Mode when Bot wins a Clash round
  useEffect(() => {
    if (
      screen !== 'playing' ||
      mode !== 'clash' ||
      opponentType !== 'bot' ||
      clashOpen ||
      pendingPlacer !== 'O' ||
      pendingPlacements <= 0 ||
      winner !== null
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const move = chooseBotMove(board, 'O', botDifficulty);
      if (move >= 0) {
        applyLocalCellPlacement(move, 'O');
      }
    }, 520);

    return () => clearTimeout(timer);
  }, [
    screen,
    mode,
    opponentType,
    clashOpen,
    pendingPlacer,
    pendingPlacements,
    winner,
    board,
    botDifficulty,
    applyLocalCellPlacement,
  ]);

  const handleCellClick = async (index: number) => {
    if (winner !== null || board[index] !== null) return;

    const markToPlace: Mark =
      mode === 'classic' ? currentTurn : pendingPlacer ?? 'X';
    applyLocalCellPlacement(index, markToPlace);
  };

  const handleSubmitClashScore = useCallback(
    async (mark: Mark, score: number) => {
      if (opponentType === 'bot') {
        const botScore = generateBotClashScore(activeMinigame, botDifficulty);
        const remaining = getAvailableMoves(board).length;
        const resolution = resolveClashRound(
          score,
          botScore,
          clashStreaks,
          remaining
        );

        setClashXScore(score);
        setClashOScore(botScore);
        setLastClashSummary({
          round: clashRound,
          minigame: activeMinigame,
          xScore: score,
          oScore: botScore,
          winner: resolution.winner,
          bonusTriggered: resolution.bonusTriggered,
        });

        if (!resolution.isTie) {
          setClashStreaks(resolution.nextStreaks);
          if (resolution.winner === 'X') {
            setBestStreak((b) => Math.max(b, clashStreaks.X + 1));
          }
          setPendingPlacer(resolution.winner);
          setPendingPlacements(resolution.placementsAwarded);
          if (resolution.bonusTriggered) {
            soundEngine.playStreakBonus();
          }
        }
        return;
      }

      if (mark === 'X') {
        setClashXScore(score);
      } else {
        const xVal = clashXScore ?? 0;
        const remaining = getAvailableMoves(board).length;
        const resolution = resolveClashRound(
          xVal,
          score,
          clashStreaks,
          remaining
        );
        setClashOScore(score);
        setLastClashSummary({
          round: clashRound,
          minigame: activeMinigame,
          xScore: xVal,
          oScore: score,
          winner: resolution.winner,
          bonusTriggered: resolution.bonusTriggered,
        });

        if (!resolution.isTie) {
          setClashStreaks(resolution.nextStreaks);
          setPendingPlacer(resolution.winner);
          setPendingPlacements(resolution.placementsAwarded);
          if (resolution.bonusTriggered) {
            soundEngine.playStreakBonus();
          }
        }
      }
    },
    [
      opponentType,
      activeMinigame,
      botDifficulty,
      board,
      clashStreaks,
      clashRound,
      clashXScore,
    ]
  );

  const handleContinueAfterClash = () => {
    if (lastClashSummary?.winner === null) {
      setClashXScore(null);
      setClashOScore(null);
      setLastClashSummary(null);
      return;
    }
    setClashOpen(false);
  };

  const handleRestartMatch = useCallback(
    async (keepScores = true) => {
      const nextStarter: Mark = startingMark === 'X' ? 'O' : 'X';
      resetMatchState(mode, opponentType, nextStarter, !keepScores);
      setScreen('playing');
    },
    [opponentType, startingMark, mode, resetMatchState]
  );

  const enterOnline = async (action:()=>Promise<{room:OnlineRoom}>) => {
    setRoomError(null);setRoomBusy(true);
    try {
      await onlineGame.profile({name:playerName.trim(),avatarId:playerAvatar,publicLeaderboard});
      const data=await action();setOnlineRoom(data.room);
      window.history.replaceState(null,'',`/room/${data.room.code}`);
    } catch(error){setRoomError(error instanceof Error?error.message:'Unable to connect.');}
    finally{setRoomBusy(false);}
  };
  const handleCreateRoom=(roomMode:GameMode)=>enterOnline(()=>onlineGame.create(roomMode));
  const handleJoinRoom=(code:string)=>enterOnline(()=>onlineGame.join(code));

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (isTyping) return;

      if (screen === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        if (target?.tagName !== 'BUTTON') {
          e.preventDefault();
          handleStartClassic();
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      } else if (
        (e.key === 'r' || e.key === 'R') &&
        (screen === 'playing' || screen === 'gameover')
      ) {
        handleRestartMatch(true);
      } else if (e.key === 'Escape') {
        if (leaderboardOpen) {
          setLeaderboardOpen(false);
        } else if (screen === 'playing' || screen === 'gameover') {
          setClashOpen(false);
          setScreen('title');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screen,
    leaderboardOpen,
    handleStartClassic,
    handleToggleMute,
    handleRestartMatch,
  ]);

  if(onlineRoom)return <OnlineRoomView initialRoom={onlineRoom} muted={muted} onToggleMute={handleToggleMute} onExit={()=>{setOnlineRoom(null);window.history.replaceState(null,'','/');}} />;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {screen === 'title' && (
          <motion.div
            key="title"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <LobbyScreen
              publicLeaderboard={publicLeaderboard}
              onPublicLeaderboardChange={setPublicLeaderboard}
              inviteCode={initialRoomCode}
              playerName={playerName}
              playerAvatar={playerAvatar}
              opponentType={lobbyOpponent}
              botDifficulty={botDifficulty}
              minigameSelection={minigameSelection}
              muted={muted}
              roomError={roomError}
              roomBusy={roomBusy}
              onPlayerNameChange={setPlayerName}
              onPlayerAvatarChange={setPlayerAvatar}
              onOpponentTypeChange={setLobbyOpponent}
              onBotDifficultyChange={setBotDifficulty}
              onMinigameSelectionChange={setMinigameSelection}
              onToggleMute={handleToggleMute}
              onStartClassic={handleStartClassic}
              onStartClash={handleStartClash}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onOpenLeaderboard={() => {
                fetchLeaderboard();
                setLeaderboardOpen(true);
              }}
            />
          </motion.div>
        )}

        {screen === 'waiting' && room && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <WaitingRoomScreen
              room={room}
              onSwitchToBot={() => {
                setRoom(null);
                resetMatchState(room.mode, 'bot', 'X', true);
                setScreen('playing');
              }}
              onCancel={() => {
                setRoom(null);
                setScreen('title');
              }}
            />
          </motion.div>
        )}

        {(screen === 'playing' || screen === 'gameover') && (
          <motion.div
            key="arena"
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <ArenaScreen
              mode={mode}
              opponentType={opponentType}
              botDifficulty={botDifficulty}
              roomCode={room?.code ?? null}
              localRoomMark={localRoomMark}
              board={board}
              currentTurn={currentTurn}
              winningLine={winningLine}
              winner={winner}
              playerX={playerX}
              playerO={playerO}
              sessionScores={sessionScores}
              clashRound={clashRound}
              clashStreaks={clashStreaks}
              pendingPlacements={pendingPlacements}
              pendingPlacer={pendingPlacer}
              activeMinigame={activeMinigame}
              botThinking={botThinking}
              muted={muted}
              onCellClick={handleCellClick}
              onLaunchClash={() => {
                soundEngine.playClashStart();
                setClashOpen(true);
              }}
              onRestart={() => handleRestartMatch(true)}
              onBackToLobby={() => {
                setClashOpen(false);
                setRoom(null);
                setScreen('title');
              }}
              onOpenLeaderboard={() => {
                fetchLeaderboard();
                setLeaderboardOpen(true);
              }}
              onToggleMute={handleToggleMute}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {screen === 'playing' && mode === 'clash' && clashOpen && !winner && (
          <ClashMinigameModal
            key="clash-modal"
            round={clashRound}
            minigame={activeMinigame}
            opponentType={opponentType}
            playerX={playerX}
            playerO={playerO}
            localRoomMark={localRoomMark}
            xSubmittedScore={clashXScore}
            oSubmittedScore={clashOScore}
            lastSummary={lastClashSummary}
            onSubmitSingleScore={handleSubmitClashScore}
            onContinueAfterSummary={handleContinueAfterClash}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {screen === 'gameover' && winner && (
          <OutcomeModal
            key="outcome-modal"
            winner={winner}
            mode={mode}
            playerX={playerX}
            playerO={playerO}
            moveCount={moveCount}
            sessionScores={sessionScores}
            bestStreak={bestStreak}
            onPlayAgain={() => handleRestartMatch(true)}
            onBackToLobby={() => {
              setRoom(null);
              setScreen('title');
            }}
            onOpenLeaderboard={() => {
              fetchLeaderboard();
              setLeaderboardOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {leaderboardOpen && (
          <LeaderboardModal
            key="leaderboard-modal"
            entries={leaderboardEntries}
            loading={leaderboardLoading}
            error={leaderboardState.error}
            mode={leaderboardState.mode}
            onModeChange={leaderboardState.setMode}
            onClose={() => setLeaderboardOpen(false)}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
