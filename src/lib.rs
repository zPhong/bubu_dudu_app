use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Tạo nút Thoát
            let quit_i = MenuItem::with_id(app, "quit", "Thoát Ứng Dụng", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_i])?;

            // Gắn vào khay hệ thống (System Tray)
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
