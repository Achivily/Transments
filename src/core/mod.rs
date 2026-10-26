//! Conversion core shared by the desktop app and the tests. No UI dependencies.

pub mod bmp;
pub mod ffmpeg;
#[cfg(feature = "heif")]
pub mod heif;
pub mod image_conv;
pub mod scan;
pub mod video_conv;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

pub use scan::FileItem;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Image,
    Video,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileResult {
    pub ok: bool,
    pub file: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub index: usize,
    pub total: usize,
    pub file: String,
    pub path: String,
    /// "running" | "done" | "error"
    pub status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Per-file progress 0..=1 while running (video only).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub cancelled: bool,
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub results: Vec<FileResult>,
}

impl Summary {
    pub fn error(message: impl Into<String>) -> Self {
        Summary { ok: false, error: Some(message.into()), ..Default::default() }
    }
}

/// One conversion service per media kind: guards against concurrent runs and carries the cancel flag.
#[derive(Default)]
pub struct Service {
    running: AtomicBool,
    cancelled: Arc<AtomicBool>,
}

impl Service {
    pub fn cancel(&self) -> bool {
        if self.running.load(Ordering::SeqCst) {
            self.cancelled.store(true, Ordering::SeqCst);
        }
        self.cancelled.load(Ordering::SeqCst)
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    pub fn cancel_flag(&self) -> Arc<AtomicBool> {
        self.cancelled.clone()
    }

    /// Runs `convert` over `files` on `workers` threads, reporting each finished file.
    pub fn run<C, P>(&self, files: &[FileItem], output_dir: &str, workers: usize, convert: C, progress: P) -> Summary
    where
        C: Fn(usize, &FileItem) -> Result<String, String> + Sync,
        P: Fn(Progress) + Sync,
    {
        if self.running.swap(true, Ordering::SeqCst) {
            return Summary::error("A conversion is already running");
        }
        self.cancelled.store(false, Ordering::SeqCst);
        let summary = self.run_inner(files, output_dir, workers, &convert, &progress);
        self.running.store(false, Ordering::SeqCst);
        summary
    }

    fn run_inner(
        &self,
        files: &[FileItem],
        output_dir: &str,
        workers: usize,
        convert: &(dyn Fn(usize, &FileItem) -> Result<String, String> + Sync),
        progress: &(dyn Fn(Progress) + Sync),
    ) -> Summary {
        if let Err(err) = std::fs::create_dir_all(output_dir) {
            return Summary::error(err.to_string());
        }
        let next = AtomicUsize::new(0);
        let results = Mutex::new(Vec::with_capacity(files.len()));
        std::thread::scope(|scope| {
            for _ in 0..workers.max(1) {
                scope.spawn(|| loop {
                    if self.is_cancelled() {
                        return;
                    }
                    let i = next.fetch_add(1, Ordering::SeqCst);
                    let Some(file) = files.get(i) else { return };
                    let outcome = convert(i, file);
                    // A cancelled video job reports its own abort; don't count it as a failure.
                    if self.is_cancelled() && outcome.is_err() {
                        return;
                    }
                    let res = FileResult {
                        ok: outcome.is_ok(),
                        file: file.name.clone(),
                        path: file.path.clone(),
                        output: outcome.as_ref().ok().cloned(),
                        error: outcome.as_ref().err().cloned(),
                    };
                    progress(Progress {
                        index: i,
                        total: files.len(),
                        file: file.name.clone(),
                        path: file.path.clone(),
                        status: if res.ok { "done" } else { "error" },
                        message: res.error.clone(),
                        percent: None,
                    });
                    results.lock().unwrap().push(res);
                });
            }
        });
        let results = results.into_inner().unwrap();
        let succeeded = results.iter().filter(|r| r.ok).count();
        Summary {
            ok: true,
            error: None,
            cancelled: self.is_cancelled(),
            total: files.len(),
            succeeded,
            failed: results.len() - succeeded,
            results,
        }
    }
}

/// `<output_dir>/<relative dir of file>/<stem><ext>`; refuses to clobber unless `overwrite`.
pub fn output_path(file: &FileItem, output_dir: &str, ext: &str, overwrite: bool) -> Result<PathBuf, String> {
    let src = Path::new(&file.path);
    let stem = src.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let mut dir = PathBuf::from(output_dir);
    if let Some(parent) = file.relative_path.as_deref().and_then(|r| Path::new(r).parent()) {
        dir.push(parent);
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let out = dir.join(format!("{stem}{ext}"));
    if out.exists() && !overwrite {
        return Err("Target exists (overwrite off)".into());
    }
    Ok(out)
}

pub fn default_workers() -> usize {
    let cpus = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(2);
    cpus.saturating_sub(1).clamp(1, 4)
}
