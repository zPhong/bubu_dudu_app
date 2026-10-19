import { useEffect, useState } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import {
  CHARACTERS,
  SCHEDULE_ACTIONS,
  RANDOM_INTERVALS,
  DECAY_OPTIONS,
  loadConfig,
  saveConfig,
} from "./config";
import "./App.css";

function Settings() {
  const [config, setConfig] = useState(loadConfig);

  // Đồng bộ khi bấm mute trên cửa sổ pet
  useEffect(() => {
    const unlisten = listen("config-changed", (e) => setConfig(e.payload));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const update = (patch) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveConfig(next);
    emitTo("main", "config-changed", next);
  };

  const updateSchedule = (id, patch) => {
    update({ schedules: config.schedules.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  };

  const changeAction = (id, actionId) => {
    const preset = SCHEDULE_ACTIONS.find((a) => a.id === actionId);
    updateSchedule(id, { action: actionId, message: preset?.message ?? "" });
  };

  const addSchedule = () => {
    const preset = SCHEDULE_ACTIONS[0];
    update({
      schedules: [
        ...config.schedules,
        { id: String(Date.now()), time: "08:00", action: preset.id, message: preset.message, enabled: true },
      ],
    });
  };

  const removeSchedule = (id) => {
    update({ schedules: config.schedules.filter((s) => s.id !== id) });
  };

  return (
    <div className="settings">
      <h2>Cài đặt</h2>

      <section>
        <h3>Nhân vật</h3>
        <div className="row">
          {CHARACTERS.map((c) => (
            <label key={c.id} className="choice">
              <input
                type="radio"
                name="character"
                checked={config.character === c.id}
                onChange={() => update({ character: c.id })}
              />
              {c.label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3>Hiển thị</h3>
        <label className="field">
          Đổi ảnh ngẫu nhiên mỗi
          <select
            value={config.randomInterval}
            onChange={(e) => update({ randomInterval: Number(e.target.value) })}
          >
            {RANDOM_INTERVALS.map((s) => (
              <option key={s} value={s}>{s} giây</option>
            ))}
          </select>
        </label>
        <label className="field">
          Thời gian hiện lịch (giây)
          <input
            type="number"
            min={5}
            value={config.scheduleDuration}
            onChange={(e) => update({ scheduleDuration: Math.max(5, Number(e.target.value) || 5) })}
          />
        </label>
      </section>

      <section>
        <h3>Âm thanh</h3>
        <label className="field">
          Tắt tiếng
          <input
            type="checkbox"
            checked={config.muted}
            onChange={(e) => update({ muted: e.target.checked })}
          />
        </label>
        <label className="field">
          Âm lượng ({config.volume}%)
          <input
            className="volume"
            type="range"
            min={0}
            max={100}
            disabled={config.muted}
            value={config.volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
          />
        </label>
      </section>

      <section>
        <h3>Thú ảo</h3>
        <label className="field">
          Bật nuôi thú ảo (chỉ số + nút Ăn / Chơi / Ngủ)
          <input
            type="checkbox"
            checked={config.virtualPet}
            onChange={(e) => update({ virtualPet: e.target.checked })}
          />
        </label>
        <label className="field">
          Chỉ số no / vui / sức giảm 1 điểm mỗi
          <select
            disabled={!config.virtualPet}
            value={config.decayMinutes}
            onChange={(e) => update({ decayMinutes: Number(e.target.value) })}
          >
            {DECAY_OPTIONS.map((m) => (
              <option key={m} value={m}>{m} phút</option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h3>Lịch hàng ngày</h3>
        {config.schedules.map((s) => (
          <div key={s.id} className="schedule-row">
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => updateSchedule(s.id, { enabled: e.target.checked })}
            />
            <input
              type="time"
              value={s.time}
              onChange={(e) => updateSchedule(s.id, { time: e.target.value })}
            />
            <select value={s.action} onChange={(e) => changeAction(s.id, e.target.value)}>
              {SCHEDULE_ACTIONS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <button onClick={() => removeSchedule(s.id)}>Xóa</button>
            <input
              className="message"
              type="text"
              placeholder="Lời nhắn"
              value={s.message}
              onChange={(e) => updateSchedule(s.id, { message: e.target.value })}
            />
          </div>
        ))}
        <button onClick={addSchedule}>+ Thêm lịch</button>
      </section>
    </div>
  );
}

export default Settings;
