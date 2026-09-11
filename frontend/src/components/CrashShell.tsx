import { useEffect, useRef, type ReactNode } from 'react';
import { HistoryFeed } from './HistoryFeed';
import { HistoryStrip } from './HistoryStrip';
import { useGame } from '../state/GameContext';

interface CrashShellProps {
  children: ReactNode;
  rail?: ReactNode;
  hideSidebar?: boolean;
  bleed?: boolean;
  /** Растянуть каркас на всю доступную высоту экрана. */
  fill?: boolean;
}

/** Каркас crash-казино: история слева (на уровне контента), бегущая лента сверху. */
export function CrashShell({
  children,
  rail,
  hideSidebar = false,
  bleed = false,
  fill = false,
}: CrashShellProps): JSX.Element {
  const { history, setup } = useGame();
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hideSidebar || fill) {
      return undefined;
    }

    const sync = () => {
      const sidebar = sidebarRef.current;
      const stage = stageRef.current;
      const root = sidebar?.closest('.crash');
      if (!sidebar || !stage) {
        return;
      }

      // С marquee сайдбар тянется по grid на обе строки; без — подгоняем под stage.
      if (root?.classList.contains('crash--marquee')) {
        sidebar.style.height = '';
        sidebar.style.maxHeight = '';
        return;
      }

      const height = stage.offsetHeight;
      sidebar.style.height = `${height}px`;
      sidebar.style.maxHeight = `${height}px`;
    };

    sync();

    const observer = new ResizeObserver(sync);
    if (stageRef.current) {
      observer.observe(stageRef.current);
    }
    if (railRef.current) {
      observer.observe(railRef.current);
    }
    window.addEventListener('resize', sync);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [fill, hideSidebar, rail, bleed]);

  const showMarquee = !hideSidebar;

  return (
    <div
      className={`crash${hideSidebar ? ' crash--solo' : ''}${bleed ? ' crash--bleed' : ''}${rail ? ' crash--rail' : ''}${showMarquee ? ' crash--marquee' : ''}${fill ? ' crash--fill' : ''}`}
    >
      {showMarquee && (
        <div className="crash__marquee">
            <HistoryStrip entries={history} marquee />
        </div>
      )}

      {!hideSidebar && (
        <aside className="crash__sidebar" ref={sidebarRef}>
          <div className="crash__sidebar-head">
            <span className="crash__sidebar-title">Раунды</span>
            <span className="crash__sidebar-meta text-xs muted">{setup?.session.historySize ?? 0}</span>
          </div>
          <div className="crash__sidebar-feed">
            <HistoryFeed entries={history} />
          </div>
        </aside>
      )}

      <div className="crash__stage" ref={stageRef}>
        <main className={`crash__main${bleed ? ' crash__main--bleed' : ''}`}>{children}</main>
        {rail && (
          <aside className="crash__rail" ref={railRef}>
            {rail}
          </aside>
        )}
      </div>
    </div>
  );
}
