// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, Window};

#[tauri::command]
fn flash_taskbar(window: Window) -> Result<(), String> {
    // Request attention/flash the taskbar (works on Windows, macOS, Linux)
    window.request_user_attention(Some(tauri::UserAttentionType::Informational))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let window = _app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![flash_taskbar])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
