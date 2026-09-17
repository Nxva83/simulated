#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    name: String,
    is_dir: bool,
}

#[tauri::command]
fn list_dir(path: Option<String>) -> Result<Vec<Entry>, String> {
    let dir = path
        .or_else(|| std::env::var("HOME").ok())
        .ok_or("no HOME")?;
    let mut out = Vec::new();
    for e in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        out.push(Entry {
            name: e.file_name().to_string_lossy().into_owned(),
            is_dir: e.file_type().map(|t| t.is_dir()).unwrap_or(false),
        });
    }
    Ok(out)
}

#[tauri::command]
fn ready() {
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
    println!("READY {ms}");
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_dir, ready])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
