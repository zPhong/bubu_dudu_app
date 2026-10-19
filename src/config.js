// Quy ước thư mục: src/assets/characters/<nhân vật>/
//   idle, hover, wave, drag, drag_left, drag_right  -> ảnh theo trạng thái
//   random/*                                         -> thêm ảnh cho chế độ random
//   schedule/<action>                                -> ảnh riêng cho lịch (không random)
//   status/<hungry|sad|tired>_<1|2>                  -> ảnh theo mốc chỉ số thấp
//   actions/<eat|play|sleep>                         -> ảnh khi bấm nút tương tác
//   sounds/*                                         -> âm thanh chung, phát random
//   sounds/<click|eat|play|sleep|action lịch>/*      -> âm thanh riêng theo sự kiện
const files = import.meta.glob("./assets/characters/**/*.{gif,png,webp,jpg}", {
  eager: true,
  query: "?url",
  import: "default",
});
const soundFiles = import.meta.glob("./assets/characters/*/sounds/**/*.{mp3,wav,ogg,m4a}", {
  eager: true,
  query: "?url",
  import: "default",
});

export const CHARACTERS = [
  { id: "bubu", label: "Bubu" },
  { id: "dudu", label: "Dudu" },
  { id: "bubu_vs_dudu", label: "Bubu & Dudu" },
];

export const SCHEDULE_ACTIONS = [
  { id: "wakeup", label: "Thức dậy", message: "Chào buổi sáng! Dậy thôi nào!" },
  { id: "breakfast", label: "Ăn sáng", message: "Đến giờ ăn sáng rồi, ăn no để làm việc nha!" },
  { id: "lunch", label: "Ăn trưa", message: "Trưa rồi, nghỉ tay đi ăn cơm thôi!" },
  { id: "nap", label: "Ngủ trưa", message: "Chợp mắt một chút cho khỏe nhé!" },
  { id: "snack", label: "Ăn xế", message: "Ăn chút gì cho đỡ đói nè!" },
  { id: "water", label: "Uống nước", message: "Uống nước đi nào, đừng để khát nha!" },
  { id: "exercise", label: "Tập thể dục", message: "Đứng dậy vươn vai vận động thôi!" },
  { id: "dinner", label: "Ăn tối", message: "Tới giờ ăn tối rồi, về ăn cơm thôi!" },
  { id: "sleep", label: "Đi ngủ", message: "Khuya rồi, đi ngủ thôi nào!" },
];

export const RANDOM_INTERVALS = [10, 20, 30, 60];

// Số phút để mỗi chỉ số giảm 1 điểm (thang 0-100)
export const DECAY_OPTIONS = [1, 2, 5, 10, 30];

export const STATS = [
  { id: "hunger", label: "No", icon: "🍙", lowState: "hungry", messages: { 1: "Bụng đói rồi nè...", 2: "Đói quá, cho ăn đi mà!" } },
  { id: "mood", label: "Vui", icon: "😊", lowState: "sad", messages: { 1: "Hơi buồn một chút...", 2: "Buồn quá, chơi với tui đi!" } },
  { id: "energy", label: "Sức", icon: "⚡", lowState: "tired", messages: { 1: "Hơi mệt rồi...", 2: "Mệt quá, cho ngủ đi!" } },
];

// Mốc chỉ số: dưới 20 -> mốc 2 (nặng), dưới 50 -> mốc 1 (nhẹ)
const STAT_LEVELS = [
  { level: 2, below: 20 },
  { level: 1, below: 50 },
];

export const INTERACTIONS = [
  { id: "eat", label: "Ăn", icon: "🍚", message: "Ngon quá đi!", duration: 4000, effect: { hunger: 35, mood: 5 } },
  { id: "play", label: "Chơi", icon: "🎾", message: "Vui quá đi!", duration: 4000, effect: { mood: 35, energy: -10, hunger: -5 } },
  { id: "sleep", label: "Ngủ", icon: "💤", message: "Zzz...", duration: 8000, effect: { energy: 50 } },
];

const STORAGE_KEY = "pet-config";
const STATS_KEY = "pet-stats";

export const DEFAULT_CONFIG = {
  character: "bubu_vs_dudu",
  randomInterval: 10,
  scheduleDuration: 60,
  virtualPet: true,
  decayMinutes: 2,
  muted: false,
  volume: 70,
  schedules: [
    { id: "1", time: "07:30", action: "breakfast", message: "Đến giờ ăn sáng rồi, ăn no để làm việc nha!", enabled: true },
    { id: "2", time: "12:00", action: "lunch", message: "Trưa rồi, nghỉ tay đi ăn cơm thôi!", enabled: true },
    { id: "3", time: "19:00", action: "dinner", message: "Tới giờ ăn tối rồi, về ăn cơm thôi!", enabled: true },
  ],
};

export function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

const clampStat = (value) => Math.min(100, Math.max(0, value));

export function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY));
    if (saved?.updatedAt) return saved;
  } catch {
    // dữ liệu hỏng -> dùng mặc định
  }
  return { hunger: 100, mood: 100, energy: 100, updatedAt: Date.now() };
}

export function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// Trừ điểm theo thời gian đã trôi qua kể từ lần cập nhật trước (kể cả lúc tắt app)
export function decayStats(stats, decayMinutes) {
  const now = Date.now();
  const drop = (now - stats.updatedAt) / 60000 / decayMinutes;
  const next = { updatedAt: now };
  for (const { id } of STATS) next[id] = clampStat(stats[id] - drop);
  return next;
}

export function applyEffect(stats, effect) {
  const next = { ...stats };
  for (const [id, delta] of Object.entries(effect)) next[id] = clampStat(next[id] + delta);
  return next;
}

// Trạng thái tệ nhất đang dưới mốc, ví dụ { asset: "hungry_2", message: "..." }
export function getWorstStatus(stats) {
  let worst = null;
  for (const stat of STATS) {
    const match = STAT_LEVELS.find((l) => stats[stat.id] < l.below);
    if (match && (!worst || stats[stat.id] < worst.value)) {
      worst = {
        value: stats[stat.id],
        asset: `${stat.lowState}_${match.level}`,
        message: stat.messages[match.level],
      };
    }
  }
  return worst;
}

const ASSETS = {};
const getEntry = (character) => (ASSETS[character] ??= { base: {}, folders: {}, random: [], sounds: {} });

for (const [path, url] of Object.entries(soundFiles)) {
  const [character, , ...rest] = path.replace("./assets/characters/", "").split("/");
  const event = rest.length === 1 ? "_all" : rest[0];
  (getEntry(character).sounds[event] ??= []).push(url);
}

for (const [path, url] of Object.entries(files)) {
  const [character, ...rest] = path.replace("./assets/characters/", "").split("/");
  const entry = getEntry(character);
  const name = rest[rest.length - 1].replace(/\.\w+$/, "");

  if (rest.length === 1) {
    entry.base[name] = url;
    if (!name.startsWith("drag")) entry.random.push(url);
  } else if (rest[0] === "random") {
    entry.random.push(url);
  } else {
    (entry.folders[rest[0]] ??= {})[name] = url;
  }
}

const fallbackChain = (character) =>
  [character, "bubu_vs_dudu", "bubu", "dudu"].filter((c, i, arr) => ASSETS[c] && arr.indexOf(c) === i);

// Tìm ảnh theo thứ tự tên ưu tiên, nhân vật thiếu ảnh sẽ mượn của nhân vật khác
export function getAsset(character, ...names) {
  for (const name of names) {
    for (const c of fallbackChain(character)) {
      if (ASSETS[c].base[name]) return ASSETS[c].base[name];
    }
  }
  return null;
}

export function getFolderAsset(character, folder, name, ...fallbackNames) {
  for (const c of fallbackChain(character)) {
    const url = ASSETS[c].folders[folder]?.[name];
    if (url) return url;
  }
  return getAsset(character, ...fallbackNames);
}

export function getScheduleAsset(character, action) {
  return getFolderAsset(character, "schedule", action, "wave", "hover", "idle");
}

// Random 1 file trong sounds/<event>/, không có thì lấy trong sounds/
export function getRandomSound(character, event) {
  for (const key of [event, "_all"]) {
    for (const c of fallbackChain(character)) {
      const list = ASSETS[c].sounds[key];
      if (list?.length) return list[Math.floor(Math.random() * list.length)];
    }
  }
  return null;
}

export function getRandomPool(character) {
  return ASSETS[character]?.random ?? [];
}
