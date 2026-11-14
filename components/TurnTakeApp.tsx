'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  LeaderboardEntry,
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

  // Room multiplayer state
  const [room, setRoom] = useState<RoomState | null>(null);
  const [localRoomMark, setLocalRoomMark] = useState<Mark>('X');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);

  // UI & Audio state
  const [muted, setMuted] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<
    LeaderboardEntry[]
  >([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

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

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboardEntries(data.entries ?? []);
      }
    } catch {
      // ignore offline transient error
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const recordOutcomeToLeaderboard = useCallback(
    async (matchWinner: Mark | 'draw', matchMode: GameMode, streak: number) => {
      if (recordedFinishRef.current) return;
      recordedFinishRef.current = true;
      const myMark: Mark = opponentType === 'room' ? localRoomMark : 'X';
      const outcome =
        matchWinner === 'draw'
          ? 'draw'
          : matchWinner === myMark
            ? 'win'
            : 'loss';

      try {
        const res = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: playerName.trim() || 'Player X',
            avatarId: playerAvatar,
            outcome,
            mode: matchMode,
            streakAchieved: streak,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setLeaderboardEntries(data.entries ?? []);
        }
      } catch {
        // non-blocking
      }
    },
    [opponentType, localRoomMark, playerName, playerAvatar]
  );

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

  // Initial leaderboard & optional invite link join
  useEffect(() => {
    let active = true;
    fetch('/api/leaderboard')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.entries) {
          setLeaderboardEntries(data.entries);
        }
      })
      .catch(() => {});

    if (initialRoomCode) {
      const code = initialRoomCode.trim().toUpperCase();
      fetch(`/api/rooms/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          playerName: 'Player O',
          avatarId: 'shield-face',
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Could not join room.');
          if (!active) return;
          setRoom(data.room);
          setLocalRoomMark('O');
          setOpponentType('room');
          setMode(data.room.mode);
          setBoard(data.room.board);
          setCurrentTurn(data.room.currentTurn);
          setActiveMinigame(data.room.activeMinigame);
          setClashOpen(data.room.mode === 'clash');
          setScreen('playing');
        })
        .catch((err) => {
          if (active) {
            setRoomError(err instanceof Error ? err.message : 'Room unavailable.');
          }
        });
    }

    return () => {
      active = false;
    };
  }, [initialRoomCode]);

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
        recordOutcomeToLeaderboard(result.winner, mode, bestStreak);
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
      bestStreak,
      pendingPlacements,
      clashRound,
      minigameSelection,
      recordOutcomeToLeaderboard,
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

  // Room polling synchronization
  useEffect(() => {
    if (opponentType !== 'room' || !room?.code) return;
    if (screen !== 'waiting' && screen !== 'playing' && screen !== 'gameover') {
      return;
    }

    const syncFromRoom = (nextRoom: RoomState) => {
      setRoom(nextRoom);
      setBoard(nextRoom.board);
      setCurrentTurn(nextRoom.currentTurn);
      setWinner(nextRoom.winner);
      setWinningLine(nextRoom.winningLine);
      setMoveCount(nextRoom.moveCount);
      setSessionScores(nextRoom.scores);
      setClashRound(nextRoom.clashRound);
      setClashStreaks(nextRoom.clashStreaks);
      setPendingPlacements(nextRoom.pendingPlacements);
      setPendingPlacer(nextRoom.pendingPlacer);
      setActiveMinigame(nextRoom.activeMinigame);
      setClashXScore(nextRoom.clashSubmissions.X);
      setClashOScore(nextRoom.clashSubmissions.O);
      setLastClashSummary(nextRoom.lastClashSummary);

      if (nextRoom.status === 'active' && screen === 'waiting') {
        setScreen('playing');
      }
      if (nextRoom.status === 'finished' && nextRoom.winner) {
        setClashOpen(false);
        setScreen('gameover');
        recordOutcomeToLeaderboard(nextRoom.winner, nextRoom.mode, bestStreak);
      } else if (nextRoom.status === 'active' && screen === 'gameover') {
        recordedFinishRef.current = false;
        setScreen('playing');
      }
    };

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(room.code)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.room) syncFromRoom(data.room);
        }
      } catch {
        // ignore transient poll errors
      }
    }, 900);

    return () => clearInterval(poll);
  }, [
    opponentType,
    room?.code,
    screen,
    bestStreak,
    recordOutcomeToLeaderboard,
  ]);

  const handleCellClick = async (index: number) => {
    if (winner !== null || board[index] !== null) return;

    if (opponentType === 'room' && room) {
      const res = await fetch(`/api/rooms/${encodeURIComponent(room.code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          mark: localRoomMark,
          cellIndex: index,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          soundEngine.playPlaceMark(localRoomMark);
          setRoom(data.room);
          setBoard(data.room.board);
          setCurrentTurn(data.room.currentTurn);
          setWinner(data.room.winner);
          setWinningLine(data.room.winningLine);
          setMoveCount(data.room.moveCount);
          setSessionScores(data.room.scores);
          setPendingPlacements(data.room.pendingPlacements);
          setPendingPlacer(data.room.pendingPlacer);
          setClashRound(data.room.clashRound);
          setActiveMinigame(data.room.activeMinigame);
          if (data.room.winner) {
            setScreen('gameover');
          }
        }
      }
      return;
    }

    const markToPlace: Mark =
      mode === 'classic' ? currentTurn : pendingPlacer ?? 'X';
    applyLocalCellPlacement(index, markToPlace);
  };

  const handleSubmitClashScore = useCallback(
    async (mark: Mark, score: number) => {
      if (opponentType === 'room' && room) {
        const res = await fetch(`/api/rooms/${encodeURIComponent(room.code)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clash_score',
            mark,
            score,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            setRoom(data.room);
            setClashXScore(data.room.clashSubmissions.X);
            setClashOScore(data.room.clashSubmissions.O);
            setLastClashSummary(data.room.lastClashSummary);
            setPendingPlacements(data.room.pendingPlacements);
            setPendingPlacer(data.room.pendingPlacer);
            setClashStreaks(data.room.clashStreaks);
          }
        }
        return;
      }

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
      room,
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
      if (opponentType === 'room' && room) {
        const res = await fetch(`/api/rooms/${encodeURIComponent(room.code)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rematch' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            recordedFinishRef.current = false;
            setRoom(data.room);
            setBoard(data.room.board);
            setCurrentTurn(data.room.currentTurn);
            setWinner(null);
            setWinningLine(null);
            setMoveCount(0);
            setClashRound(1);
            setClashStreaks({ X: 0, O: 0 });
            setPendingPlacements(0);
            setPendingPlacer(null);
            setClashOpen(data.room.mode === 'clash');
            setScreen('playing');
          }
        }
        return;
      }

      const nextStarter: Mark = startingMark === 'X' ? 'O' : 'X';
      resetMatchState(mode, opponentType, nextStarter, !keepScores);
      setScreen('playing');
    },
    [opponentType, room, startingMark, mode, resetMatchState]
  );

  const handleCreateRoom = async (roomMode: GameMode) => {
    setRoomError(null);
    setRoomBusy(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName.trim() || 'Player X',
          avatarId: playerAvatar,
          mode: roomMode,
          minigameSelection,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create room.');
      setRoom(data.room);
      setLocalRoomMark('X');
      setOpponentType('room');
      setMode(roomMode);
      setScreen('waiting');
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Unable to create room.');
    } finally {
      setRoomBusy(false);
    }
  };

  const handleJoinRoom = async (code: string) => {
    setRoomError(null);
    setRoomBusy(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          playerName: playerName.trim() || 'Player O',
          avatarId: playerAvatar,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not join room.');
      setRoom(data.room);
      setLocalRoomMark('O');
      setOpponentType('room');
      setMode(data.room.mode);
      setBoard(data.room.board);
      setCurrentTurn(data.room.currentTurn);
      setActiveMinigame(data.room.activeMinigame);
      setClashOpen(data.room.mode === 'clash');
      setScreen('playing');
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Unable to join room.');
    } finally {
      setRoomBusy(false);
    }
  };

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

  return (
    <>
      {screen === 'title' && (
        <LobbyScreen
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
      )}

      {screen === 'waiting' && room && (
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
      )}

      {(screen === 'playing' || screen === 'gameover') && (
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
      )}

      {screen === 'playing' && mode === 'clash' && clashOpen && !winner && (
        <ClashMinigameModal
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

      {screen === 'gameover' && winner && (
        <OutcomeModal
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

      {leaderboardOpen && (
        <LeaderboardModal
          entries={leaderboardEntries}
          loading={leaderboardLoading}
          onClose={() => setLeaderboardOpen(false)}
        />
      )}
    </>
  );
}
