import { useState, useReducer, useEffect } from "react";
import "./styles/theme.css";
import "./styles/global.css";
import { TabBar } from "./components/TabBar";
import { SearchTab } from "./components/SearchTab";
import { QueueTab } from "./components/QueueTab";
import { SettingsTab } from "./components/SettingsTab";
import { PlayerBar } from "./components/PlayerBar";
import { HistoryTab } from "./components/HistoryTab";
import { SetupScreen } from "./components/SetupScreen";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import type { SearchResult } from "./components/SearchResultRow";
import type { PlaylistTrack } from "./components/PlaylistTrackRow";

type Tab = "search" | "queue" | "history" | "settings";

export interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  hasSearched: boolean;
  usedFallback: boolean;
  isPlaylist: boolean;
  playlistTracks: PlaylistTrack[];
  selectedIds: Set<string>;
  playlistLoading: boolean;
}

const INITIAL_SEARCH_STATE: SearchState = {
  query: "",
  results: [],
  isSearching: false,
  hasSearched: false,
  usedFallback: false,
  isPlaylist: false,
  playlistTracks: [],
  selectedIds: new Set(),
  playlistLoading: false,
};

// Queue types — shared across components
export type QueueItemStatus =
  | { type: "pending" }
  | { type: "starting" }
  | { type: "downloading"; percent: number; speed: string }
  | { type: "converting" }
  | { type: "done"; path: string }
  | { type: "error"; message: string }
  | {
      type: "retrying";
      attempt: number;
      waitSecs: number;
      remainingSecs: number;
    };

export interface QueueItem {
  id: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: string;
  status: QueueItemStatus;
  metadataOverrides?: {
    title?: string;
    artist?: string;
    album?: string;
  };
}

export type QueueAction =
  | { type: "ADD_ITEM"; item: Omit<QueueItem, "status"> }
  | { type: "UPDATE_STATUS"; id: string; status: QueueItemStatus }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "CLEAR_DONE" }
  | {
      type: "SET_METADATA";
      id: string;
      overrides: { title?: string; artist?: string; album?: string };
    };

export interface HistoryEntry {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  downloadedAt: string; // ISO 8601
  filePath: string;
}

function queueReducer(state: QueueItem[], action: QueueAction): QueueItem[] {
  switch (action.type) {
    case "ADD_ITEM":
      if (state.some((i) => i.id === action.item.id)) return state;
      return [...state, { ...action.item, status: { type: "pending" } }];
    case "UPDATE_STATUS":
      return state.map((i) =>
        i.id === action.id ? { ...i, status: action.status } : i,
      );
    case "REMOVE_ITEM":
      return state.filter((i) => i.id !== action.id);
    case "CLEAR_DONE":
      return state.filter((i) => i.status.type !== "done");
    case "SET_METADATA":
      return state.map((i) =>
        i.id === action.id ? { ...i, metadataOverrides: action.overrides } : i,
      );
    default:
      return state;
  }
}

export interface PreviewTrack {
  id: string;
  title: string;
  audioUrl: string;
}

interface DepStatus {
  found: boolean;
  path: string | null;
  version: string | null;
}

interface DepsResult {
  ytdlp: DepStatus;
  ffmpeg: DepStatus;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [queue, dispatch] = useReducer(queueReducer, []);
  const [previewTrack, setPreviewTrack] = useState<PreviewTrack | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [searchState, setSearchState] =
    useState<SearchState>(INITIAL_SEARCH_STATE);
  const [depsReady, setDepsReady] = useState<boolean | null>(null); // null = checking
  const [initialDeps, setInitialDeps] = useState<DepsResult | null>(null);

  const { updateAvailable, version, install, dismiss } = useAutoUpdate();

  const queueBadgeCount = queue.length;

  // Check deps on mount — gate main UI until yt-dlp + ffmpeg are found
  useEffect(() => {
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      try {
        const result = await invoke<DepsResult>("check_deps");
        setInitialDeps(result);
        setDepsReady(result.ytdlp.found && result.ffmpeg.found);
      } catch {
        // If check_deps command doesn't exist (full bundled build without this command),
        // assume deps are ready and proceed normally.
        setDepsReady(true);
      }
    })();
  }, []);

  // Load history on mount to populate downloadedIds for DOWNLOADED badge
  useEffect(() => {
    (async () => {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("download-history.json", { defaults: {} });
      const entries = await store.get<HistoryEntry[]>("entries");
      if (entries) {
        setDownloadedIds(new Set(entries.map((e) => e.videoId)));
      }
    })();
  }, []);

  // 저장된 쿠키 브라우저 복원 (재시작 시 AppState 동기화 + 쿠키 추출)
  // 사용자가 명시적으로 설정한 브라우저만 사용 — 자동감지 없음.
  useEffect(() => {
    (async () => {
      const { load } = await import("@tauri-apps/plugin-store");
      const { invoke } = await import("@tauri-apps/api/core");
      const store = await load("app-settings.json", { defaults: {} });
      const savedBrowser = await store.get<string | null>("cookie_browser");
      if (savedBrowser) {
        await invoke("set_cookie_browser", { browser: savedBrowser });
        // 쿠키 추출 — 저장된 브라우저 있을 때만 실행 (keychain 접근)
        await invoke("extract_saved_cookies").catch(() => {/* 실패 무시 */});
      }
    })();
  }, []);

  const refreshDownloadedIds = async () => {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("download-history.json", { defaults: {} });
    const entries = await store.get<HistoryEntry[]>("entries");
    if (entries) {
      setDownloadedIds(new Set(entries.map((e) => e.videoId)));
    }
  };

  if (depsReady === null) return null; // still checking

  if (depsReady === false && initialDeps) {
    return (
      <SetupScreen
        deps={initialDeps}
        onReady={() => setDepsReady(true)}
      />
    );
  }

  return (
    <div
      className="app-container"
      style={{
        maxWidth: "700px",
        margin: "0 auto",
        padding: "24px",
        boxShadow: "8px 8px 0px var(--color-pink-dark)",
        border: "var(--border-style)",
        minHeight: "100vh",
        boxSizing: "border-box",
        paddingBottom: "72px",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "20px",
            color: "var(--color-pink-dark)",
            margin: "0 0 8px 0",
            lineHeight: "1.6",
          }}
        >
          mixtape
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "18px",
            color: "var(--color-blue-dark)",
            margin: "0 0 2px 0",
          }}
        >
          YouTube Music Downloader
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            color: "var(--color-blue-dark)",
            margin: 0,
          }}
        >
          ~ JingJing only, Not for commercial purpose ~
        </p>
      </header>

      <TabBar
        active={activeTab}
        onSwitch={setActiveTab}
        queueBadge={queueBadgeCount}
      />

      <main
        style={{
          border: "var(--border-style)",
          padding: "24px",
          background: "rgba(255, 183, 213, 0.1)",
          boxShadow: "inset 2px 2px 0px var(--color-pink)",
        }}
      >
        {/* SearchTab: 항상 마운트, 탭 전환 시 display 로만 감춤 */}
        <div style={{ display: activeTab === "search" ? "block" : "none" }}>
          <SearchTab
            dispatch={dispatch}
            queue={queue}
            onPreview={setPreviewTrack}
            onNavigateSettings={() => setActiveTab("settings")}
            onNavigateQueue={() => setActiveTab("queue")}
            downloadedIds={downloadedIds}
            searchState={searchState}
            onSearchStateChange={setSearchState}
          />
        </div>
        {activeTab === "queue" && (
          <QueueTab
            queue={queue}
            dispatch={dispatch}
            onNavigateSettings={() => setActiveTab("settings")}
            onHistoryUpdate={refreshDownloadedIds}
          />
        )}
        {activeTab === "history" && (
          <HistoryTab dispatch={dispatch} queue={queue} />
        )}
        {activeTab === "settings" && <SettingsTab />}
      </main>

      <PlayerBar track={previewTrack} onStop={() => setPreviewTrack(null)} />

      {updateAvailable && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            right: "20px",
            background: "var(--color-green)",
            border: "var(--border-style)",
            boxShadow: "4px 4px 0px var(--color-pink-dark)",
            padding: "12px 16px",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            zIndex: 1000,
            maxWidth: "300px",
          }}
        >
          <div style={{ marginBottom: "8px", color: "var(--color-blue-dark)" }}>
            Update available — v{version}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => install?.()}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "11px",
                padding: "4px 12px",
                background: "var(--color-pink)",
                border: "var(--border-style)",
                cursor: "pointer",
              }}
            >
              Update Now
            </button>
            <button
              onClick={dismiss}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "11px",
                padding: "4px 12px",
                background: "var(--color-blue)",
                border: "var(--border-style)",
                cursor: "pointer",
              }}
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
