#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use transments_core::compress::{self, CompressJob};
use transments_core::ffmpeg::{self, Tools};
use transments_core::image_conv::{self, ImageJob};
use transments_core::scan::{self, FileItem, IMAGE_INPUT, VIDEO_INPUT};
use transments_core::video_conv::{self, VideoJob};
use transments_core::{MediaKind, Progress, Service, Summary};

#[derive(Default)]
struct AppState {
    image: Service,
    video: Service,
    compress: Service,
    /// `None` until the first lookup; the inner option is the lookup result.
    tools: Mutex<Option<Option<Tools>>>,
}

impl AppState {
    fn service(&self, kind: MediaKind) -> &Service {
        match kind {
            MediaKind::Image => &self.image,
            MediaKind::Video => &self.video,
            MediaKind::Compress => &self.compress,
        }
    }

    fn tools(&self, refresh: bool) -> Option<Tools> {
        let mut cached = self.tools.lock().unwrap();
        if refresh || cached.is_none() {
            *cached = Some(ffmpeg::locate());
        }
        cached.clone().flatten()
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    kind: MediaKind,
    #[serde(flatten)]
    progress: Progress,
}

#[derive(Serialize)]
struct OpResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FfmpegStatus {
    found: bool,
    version: Option<String>,
    path: Option<String>,
}

#[derive(Serialize)]
struct LaunchOptions {
    lang: Option<String>,
    mode: Option<String>,
    demo: bool,
    probe: bool,
    selftest: Option<String>,
}

fn arg_value(name: &str) -> Option<String> {
    let mut args = std::env::args();
    while let Some(arg) = args.next() {
        if let Some(v) = arg.strip_prefix(&format!("{name}=")) {
            return Some(v.to_string());
        }
        if arg == name {
            return args.next();
        }
    }
    None
}

#[tauri::command]
fn launch_options() -> LaunchOptions {
    LaunchOptions {
        lang: arg_value("--lang"),
        mode: arg_value("--mode"),
        demo: std::env::args().any(|a| a == "--demo"),
        probe: arg_value("--probe").is_some(),
        selftest: arg_value("--selftest"),
    }
}

/// `--probe <file>`: the page measures its own transition frame rate and reports here.
#[tauri::command]
fn probe_report(text: String) {
    if let Some(path) = arg_value("--probe") {
        let _ = std::fs::write(path, text);
    }
}

#[tauri::command]
async fn pick_folder(app: AppHandle) -> Option<String> {
    let window = app.get_webview_window("main")?;
    app.dialog()
        .file()
        .set_parent(&window)
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
async fn pick_files(app: AppHandle, kind: MediaKind) -> Vec<FileItem> {
    let Some(window) = app.get_webview_window("main") else { return Vec::new() };
    let (label, exts) = match kind {
        MediaKind::Image => ("Images", IMAGE_INPUT),
        MediaKind::Video | MediaKind::Compress => ("Videos", VIDEO_INPUT),
    };
    let picked = app
        .dialog()
        .file()
        .set_parent(&window)
        .add_filter(label, exts)
        .blocking_pick_files()
        .unwrap_or_default();
    picked
        .into_iter()
        .filter_map(|p| p.into_path().ok())
        .filter_map(|p| scan::file_item(&p.to_string_lossy()).ok())
        .collect()
}

#[tauri::command]
async fn scan_folder(kind: MediaKind, folder: String, filter: Option<String>, recursive: bool) -> Result<Vec<FileItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scan::scan_folder(kind, Path::new(&folder), filter.as_deref(), recursive).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn resolve_paths(kind: MediaKind, paths: Vec<String>, filter: Option<String>, recursive: bool) -> Vec<FileItem> {
    tauri::async_runtime::spawn_blocking(move || scan::resolve_paths(kind, &paths, filter.as_deref(), recursive))
        .await
        .unwrap_or_default()
}

fn emitter(app: &AppHandle, kind: MediaKind) -> impl Fn(Progress) + Sync {
    let app = app.clone();
    move |progress| {
        let _ = app.emit("convert:progress", ProgressEvent { kind, progress });
    }
}

#[tauri::command]
async fn start_image(app: AppHandle, job: ImageJob) -> Summary {
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = handle.state::<AppState>();
        image_conv::run(&state.image, &job, emitter(&handle, MediaKind::Image))
    })
    .await
    .unwrap_or_else(|e| Summary::error(e.to_string()))
}

#[tauri::command]
async fn start_video(app: AppHandle, job: VideoJob) -> Summary {
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = handle.state::<AppState>();
        video_conv::run(&state.video, state.tools(false).as_ref(), &job, emitter(&handle, MediaKind::Video))
    })
    .await
    .unwrap_or_else(|e| Summary::error(e.to_string()))
}

#[tauri::command]
async fn start_compress(app: AppHandle, job: CompressJob) -> Summary {
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = handle.state::<AppState>();
        compress::run(&state.compress, state.tools(false).as_ref(), &job, emitter(&handle, MediaKind::Compress))
    })
    .await
    .unwrap_or_else(|e| Summary::error(e.to_string()))
}

#[tauri::command]
fn cancel_conversion(state: State<AppState>, kind: MediaKind) -> bool {
    state.service(kind).cancel()
}

#[tauri::command]
async fn ffmpeg_status(app: AppHandle, refresh: Option<bool>) -> FfmpegStatus {
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let tools = handle.state::<AppState>().tools(refresh.unwrap_or(false));
        FfmpegStatus {
            found: tools.is_some(),
            version: tools.as_ref().map(|t| t.version.clone()),
            path: tools.map(|t| t.ffmpeg.to_string_lossy().into_owned()),
        }
    })
    .await
    .unwrap_or(FfmpegStatus { found: false, version: None, path: None })
}

#[tauri::command]
fn open_path(path: Option<String>) -> OpResult {
    let Some(path) = path.filter(|p| !p.is_empty()) else {
        return OpResult { ok: false, error: Some("No path selected".into()) };
    };
    if !Path::new(&path).exists() {
        return OpResult { ok: false, error: Some(format!("Path not found: {path}")) };
    }
    #[cfg(windows)]
    let opened = std::process::Command::new("explorer").arg(&path).spawn();
    #[cfg(target_os = "macos")]
    let opened = std::process::Command::new("open").arg(&path).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let opened = std::process::Command::new("xdg-open").arg(&path).spawn();
    match opened {
        Ok(_) => OpResult { ok: true, error: None },
        Err(e) => OpResult { ok: false, error: Some(e.to_string()) },
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            // The page shows the window once its fonts are in; this is only a safety net.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(1500));
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.show();
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            launch_options,
            probe_report,
            pick_folder,
            pick_files,
            scan_folder,
            resolve_paths,
            start_image,
            start_video,
            start_compress,
            cancel_conversion,
            ffmpeg_status,
            open_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Transments");
}
