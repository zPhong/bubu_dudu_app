import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

function App() {
  // Trạng thái hành động: idle (đứng im), hover (di chuột vào), drag (đang kéo thả), wave (click chuột)
  const [action, setAction] = useState("idle");

  useEffect(() => {
    // Tự động đẩy app về góc phải màn hình khi mở
    const initPosition = async () => {
      const appWindow = getCurrentWindow();
      const monitor = await appWindow.currentMonitor();

      if (monitor) {
        const { width, height } = monitor.size;
        const x = width - 180 - 20;
        const y = height - 180 - 80;
        await appWindow.setPosition({ x, y });
      }
    };

    initPosition();
  }, []);

  // 1. Khi ĐÈ CHUỘT XUỐNG (MouseDown) -> Đổi sang ảnh đang bị xách/kéo đi
  const handleMouseDown = async (e) => {
    if (e.button === 0) { // Chỉ tính chuột trái
      setAction("drag"); // Đổi ảnh sang trạng thái bị xách lên lập tức
      
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    }
  };

  // 2. Khi THẢ CHUỘT RA (MouseUp) -> Quay lại trạng thái vẫy tay (Hover) vì chuột vẫn đang nằm trên người Pet
  const handleMouseUp = () => {
    setAction("hover");
  };

  // 3. Khi bấm CLICK chuột nhanh -> Hiện hội thoại chào hỏi
  const handlePetClick = () => {
    setAction("wave");
    setTimeout(() => {
      setAction("idle");
    }, 2000);
  };

  return (
    <div className="pet-container">
      <div 
        id="pet-container"
        onClick={handlePetClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => {
          // Chỉ chuyển sang hover nếu không phải đang kéo hoặc đang click chào
          if (action !== "drag" && action !== "wave") setAction("hover");
        }}
        onMouseLeave={() => {
          // Khi rời chuột ra hoàn toàn -> Quay về đứng im ngủ/chơi
          setAction("idle");
        }}
      >
        {/* TRẠNG THÁI 1: Đứng im mặc định */}
        {action === "idle" && (
          <img src="/assets/bubu_vs_dudu/idle.gif" alt="Đang đứng yên" className="pet-img" />
        )}

        {/* TRẠNG THÁI 2: Chỉ di chuột qua (Hover) -> Ảnh vẫy tay chào */}
        {action === "hover" && (
          <img src="/assets/bubu_vs_dudu/hover.gif" alt="Di chuột chào" className="pet-img" />
        )}

        {/* TRẠNG THÁI 3: Nhấn giữ đè chuột để kéo đi (Drag) -> Ảnh bị nhấc bổng lên */}
        {action === "drag" && (
          <img src="/assets/bubu_vs_dudu/drag.gif" alt="Đang bị xách đi" className="pet-img" />
        )}

        {/* TRẠNG THÁI 4: Khi click chuột xong -> Ảnh vui vẻ chào + Bong bóng thoại */}
        {action === "wave" && (
          <img src="/assets/bubu_wave.gif" alt="Đang chào" className="pet-img" />
        )}

        {action === "wave" && <div className="bubble">Xin chào bạn!</div>}
      </div>
    </div >
  );
}

export default App;
