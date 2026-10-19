import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen, emitTo } from "@tauri-apps/api/event";
import {
  STATS,
  INTERACTIONS,
  loadConfig,
  loadStats,
  saveStats,
  decayStats,
  applyEffect,
  getWorstStatus,
  getAsset,
  getFolderAsset,
  getScheduleAsset,
  getRandomPool,
  getRandomSound,
  saveConfig,
} from "./config";
import "./App.css";

const DRAG_END_DELAY = 600;
const STATS_TICK = 30000;
const PET_SIZE = 180;
const PANEL_HEIGHT = 80;

function App() {
  // Trạng thái hành động: idle (đứng im), hover (di chuột vào), drag (đang kéo thả), wave (click chuột)
  const [action, setAction] = useState("idle");
  const [config, setConfig] = useState(loadConfig);
  const [randomSrc, setRandomSrc] = useState(null);
  const [dragDir, setDragDir] = useState("right");
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [stats, setStats] = useState(() => {
    const { virtualPet, decayMinutes } = loadConfig();
    return virtualPet ? decayStats(loadStats(), decayMinutes) : loadStats();
  });
  const [interaction, setInteraction] = useState(null);

  const draggingRef = useRef(false);
  const petEnabledRef = useRef(config.virtualPet);
  const configRef = useRef(config);
  const audioRef = useRef(null);
  configRef.current = config;
  const interactionTimerRef = useRef(null);
  const lastXRef = useRef(null);
  const dragEndTimerRef = useRef(null);
  const firedRef = useRef(new Set());

  const { character } = config;

  useEffect(() => {
    // Tự động đẩy app về góc phải màn hình khi mở
    const initPosition = async () => {
      const appWindow = getCurrentWindow();
      const monitor = await appWindow.currentMonitor();

      if (monitor) {
        const { width, height } = monitor.size;
        const windowHeight = (PET_SIZE + (config.virtualPet ? PANEL_HEIGHT : 0)) * monitor.scaleFactor;
        const x = width - PET_SIZE * monitor.scaleFactor - 20;
        const y = height - windowHeight - 80;
        await appWindow.setPosition(new PhysicalPosition(x, y));
      }
    };

    initPosition();
  }, []);

  // Bật thú ảo -> nới cửa sổ xuống dưới để chứa thanh chỉ số, không đè lên nhân vật
  useEffect(() => {
    getCurrentWindow().setSize(
      new LogicalSize(PET_SIZE, PET_SIZE + (config.virtualPet ? PANEL_HEIGHT : 0)),
    );
  }, [config.virtualPet]);

  // Nhận config mới từ cửa sổ cài đặt
  useEffect(() => {
    const unlisten = listen("config-changed", (e) => setConfig(e.payload));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const playSound = (event) => {
    const { character, muted, volume } = configRef.current;
    if (muted) return;
    const url = getRandomSound(character, event);
    if (!url) return;

    audioRef.current?.pause();
    const audio = new Audio(url);
    audio.volume = volume / 100;
    audio.play().catch(() => {});
    audioRef.current = audio;
  };

  const toggleMute = () => {
    const next = { ...config, muted: !config.muted };
    if (next.muted) audioRef.current?.pause();
    setConfig(next);
    saveConfig(next);
    emitTo("settings", "config-changed", next);
  };

  // Chỉ số giảm dần theo thời gian, lưu vào máy
  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  useEffect(() => {
    // Lúc tắt thú ảo chỉ số đứng yên, bật lại thì tính tiếp từ thời điểm bật
    if (config.virtualPet && !petEnabledRef.current) {
      setStats((s) => ({ ...s, updatedAt: Date.now() }));
    }
    petEnabledRef.current = config.virtualPet;
    if (!config.virtualPet) return;

    const timer = setInterval(() => {
      setStats((s) => decayStats(s, config.decayMinutes));
    }, STATS_TICK);
    return () => clearInterval(timer);
  }, [config.virtualPet, config.decayMinutes]);

  useEffect(() => () => clearTimeout(interactionTimerRef.current), []);

  const handleInteract = (e, item) => {
    e.stopPropagation();
    if (interaction) return;
    setStats((s) => applyEffect(decayStats(s, config.decayMinutes), item.effect));
    setInteraction(item);
    playSound(item.id);
    interactionTimerRef.current = setTimeout(() => setInteraction(null), item.duration);
  };

  // Random ảnh theo chu kỳ cấu hình (không gồm ảnh schedule)
  useEffect(() => {
    setRandomSrc(null);
    const timer = setInterval(() => {
      const pool = getRandomPool(character);
      if (pool.length === 0) return;
      setRandomSrc((prev) => {
        const choices = pool.length > 1 ? pool.filter((src) => src !== prev) : pool;
        return choices[Math.floor(Math.random() * choices.length)];
      });
    }, config.randomInterval * 1000);
    return () => clearInterval(timer);
  }, [character, config.randomInterval]);

  // Kiểm tra lịch hàng ngày
  useEffect(() => {
    let hideTimer;
    const check = () => {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      const today = now.toDateString();
      const item = config.schedules.find((s) => s.enabled && s.time === hhmm);
      if (!item) return;

      const key = `${today}-${item.id}-${item.time}`;
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);

      setActiveSchedule(item);
      playSound(item.action);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setActiveSchedule(null), config.scheduleDuration * 1000);
    };

    check();
    const timer = setInterval(check, 10000);
    return () => {
      clearInterval(timer);
      clearTimeout(hideTimer);
    };
  }, [config.schedules, config.scheduleDuration]);

  // Theo dõi vị trí cửa sổ để biết đang kéo sang trái hay phải
  useEffect(() => {
    const unlisten = getCurrentWindow().onMoved(({ payload }) => {
      const lastX = lastXRef.current;
      lastXRef.current = payload.x;
      if (!draggingRef.current || lastX === null) return;

      const dx = payload.x - lastX;
      if (Math.abs(dx) > 2) setDragDir(dx < 0 ? "left" : "right");

      clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = setTimeout(endDrag, DRAG_END_DELAY);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    clearTimeout(dragEndTimerRef.current);
    setAction("hover");
  };

  // 1. Khi ĐÈ CHUỘT XUỐNG (MouseDown) -> Đổi sang ảnh đang bị xách/kéo đi
  const handleMouseDown = async (e) => {
    if (e.button === 0) { // Chỉ tính chuột trái
      draggingRef.current = true;
      setAction("drag"); // Đổi ảnh sang trạng thái bị xách lên lập tức

      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    }
  };

  // 2. Khi THẢ CHUỘT RA (MouseUp) -> Quay lại trạng thái vẫy tay (Hover) vì chuột vẫn đang nằm trên người Pet
  const handleMouseUp = () => {
    endDrag();
  };

  // 3. Khi bấm CLICK chuột nhanh -> Hiện hội thoại chào hỏi
  const handlePetClick = () => {
    setAction("wave");
    playSound("click");
    setTimeout(() => {
      setAction("idle");
    }, 2000);
  };

  // 4. Chuột phải -> Mở cửa sổ cài đặt
  const handleContextMenu = async (e) => {
    e.preventDefault();
    const existing = await WebviewWindow.getByLabel("settings");
    if (existing) {
      await existing.setFocus();
      return;
    }
    new WebviewWindow("settings", {
      url: "index.html",
      title: "Cài đặt Bubu Dudu",
      width: 460,
      height: 640,
    });
  };

  const status = config.virtualPet ? getWorstStatus(stats) : null;
  let src;
  let bubble = null;
  if (action === "drag") {
    src = getAsset(character, `drag_${dragDir}`, "drag", "idle");
  } else if (action === "wave") {
    src = getAsset(character, "wave", "hover", "idle");
    bubble = "Xin chào bạn!";
  } else if (interaction) {
    src = getFolderAsset(character, "actions", interaction.id, "wave", "hover", "idle");
    bubble = interaction.message;
  } else if (activeSchedule) {
    src = getScheduleAsset(character, activeSchedule.action);
    bubble = activeSchedule.message;
  } else if (status) {
    src = getFolderAsset(character, "status", status.asset, "idle");
    bubble = status.message;
  } else if (action === "hover") {
    src = getAsset(character, "hover", "wave", "idle");
  } else {
    src = randomSrc ?? getAsset(character, "idle");
  }

  return (
    <div className="pet-container">
      <div
        id="pet-container"
        onClick={handlePetClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => {
          // Chỉ chuyển sang hover nếu không phải đang kéo hoặc đang click chào
          if (action !== "drag" && action !== "wave") setAction("hover");
        }}
        onMouseLeave={() => {
          // Khi rời chuột ra hoàn toàn -> Quay về đứng im ngủ/chơi
          if (!draggingRef.current) setAction("idle");
        }}
      >
        {src && <img src={src} alt={action} className="pet-img" draggable={false} />}
        {bubble && <div className="bubble">{bubble}</div>}
      </div>

      {config.virtualPet && (
        <div className="pet-panel" style={{ height: PANEL_HEIGHT }}>
          <div className="pet-stats">
            {STATS.map((s) => (
              <div key={s.id} className="pet-stat" title={`${s.label}: ${Math.round(stats[s.id])}`}>
                <span>{s.icon}</span>
                <div className="pet-stat-bar">
                  <div style={{ width: `${stats[s.id]}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="pet-actions">
            {INTERACTIONS.map((item) => (
              <button
                key={item.id}
                title={item.label}
                disabled={!!interaction}
                onClick={(e) => handleInteract(e, item)}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
          <div className="pet-volume">
            <button onClick={toggleMute} className="mute-btn">
              {config.muted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
