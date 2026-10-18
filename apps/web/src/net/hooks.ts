import { useEffect, useRef, useState } from 'react';
import { EV, type GameId, type LobbyGameSummary, type TableView } from '@chieu-bai/shared';
import { call, connection, getSocket, onReconnect, session } from './client';
import { useStore } from './store';

export const useConnection = () => useStore(connection);
export const useSession = () => useStore(session);

/** Theo dõi trạng thái các bàn ở trang chủ. */
export function useLobby(): LobbyGameSummary[] | null {
  const [games, setGames] = useState<LobbyGameSummary[] | null>(null);
  const conn = useConnection();
  useEffect(() => {
    const s = getSocket();
    const watch = () => call<LobbyGameSummary[]>(EV.lobbyWatch).then((r) => r.ok && r.data && setGames(r.data));
    const onUpdate = (g: LobbyGameSummary[]) => setGames(g);
    s.on(EV.lobbyUpdate, onUpdate);
    if (s.connected) watch();
    const off = onReconnect(watch);
    s.on('connect', watch);
    return () => {
      s.off(EV.lobbyUpdate, onUpdate);
      s.off('connect', watch);
      off();
    };
  }, []);
  void conn;
  return games;
}

/** Theo dõi bàn của một game; tự đăng ký lại khi kết nối lại. */
export function useTable(gameId: GameId): { view: TableView | null; error: string | null; clockOffset: number } {
  const [view, setView] = useState<TableView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0);
  useEffect(() => {
    const s = getSocket();
    const accept = (v: TableView) => {
      if (v.gameId !== gameId) return;
      offset.current = v.serverTime - Date.now();
      setView((prev) => (prev && prev.version > v.version && prev.serverTime > v.serverTime ? prev : v));
    };
    const watch = async () => {
      const r = await call<TableView>(EV.tableWatch, { gameId });
      if (r.ok && r.data) {
        accept(r.data);
        setError(null);
      } else if (!r.ok) setError(r.error);
    };
    s.on(EV.tableUpdate, accept);
    s.on('connect', watch);
    if (s.connected) watch();
    return () => {
      s.off(EV.tableUpdate, accept);
      s.off('connect', watch);
      call(EV.tableUnwatch, { gameId });
    };
  }, [gameId]);
  return { view, error, clockOffset: offset.current };
}

/** Thời gian còn lại (ms) tới mốc deadline của server. */
export function useCountdown(deadline: number | null | undefined, clockOffset: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, deadline - (now + clockOffset));
}
