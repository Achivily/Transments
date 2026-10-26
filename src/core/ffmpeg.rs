//! Locating and probing the external ffmpeg / ffprobe binaries.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::{Deserialize, Serialize};

#[cfg(windows)]
const EXE: &str = ".exe";
#[cfg(not(windows))]
const EXE: &str = "";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tools {
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
    pub version: String,
}

/// Background-process command: no console window flashing on Windows.
pub fn command(program: &Path) -> Command {
    let mut cmd = Command::new(program);
    cmd.stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn candidates() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(dir) = std::env::var_os("TRANSMENTS_FFMPEG_DIR") {
        dirs.push(PathBuf::from(dir));
    }
    if let Some(exe_dir) = std::env::current_exe().ok().and_then(|p| p.parent().map(Path::to_path_buf)) {
        dirs.push(exe_dir.join("ffmpeg").join("bin"));
        dirs.push(exe_dir.join("ffmpeg"));
        dirs.push(exe_dir);
    }
    if let Some(path) = std::env::var_os("PATH") {
        dirs.extend(std::env::split_paths(&path));
    }
    dirs
}

/// Finds a directory holding both ffmpeg and ffprobe.
pub fn locate() -> Option<Tools> {
    candidates().into_iter().find_map(|dir| {
        let ffmpeg = dir.join(format!("ffmpeg{EXE}"));
        let ffprobe = dir.join(format!("ffprobe{EXE}"));
        if !ffmpeg.is_file() || !ffprobe.is_file() {
            return None;
        }
        let out = command(&ffmpeg).arg("-version").output().ok()?;
        let first = String::from_utf8_lossy(&out.stdout).lines().next().unwrap_or_default().to_string();
        let version = first
            .strip_prefix("ffmpeg version ")
            .and_then(|v| v.split_whitespace().next())
            .map(|v| v.split('-').next().unwrap_or(v))
            .unwrap_or("unknown")
            .to_string();
        Some(Tools { ffmpeg, ffprobe, version })
    })
}

#[derive(Debug, Clone, Default)]
pub struct MediaInfo {
    pub duration: f64,
    pub video: Option<String>,
    pub audio: Option<String>,
    /// Pixel format of the main video stream, e.g. "yuv420p10le".
    pub pix_fmt: Option<String>,
    /// Bits per second of the first audio stream, when the container reports it.
    pub audio_bitrate: Option<u64>,
}

#[derive(Deserialize)]
struct ProbeOut {
    #[serde(default)]
    streams: Vec<ProbeStream>,
    format: Option<ProbeFormat>,
}

#[derive(Deserialize)]
struct ProbeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    pix_fmt: Option<String>,
    bit_rate: Option<String>,
    #[serde(default)]
    disposition: Option<Disposition>,
}

#[derive(Deserialize, Default)]
struct Disposition {
    #[serde(default)]
    attached_pic: u8,
}

#[derive(Deserialize)]
struct ProbeFormat {
    duration: Option<String>,
}

pub fn probe(tools: &Tools, input: &Path) -> Result<MediaInfo, String> {
    let out = command(&tools.ffprobe)
        .args(["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,pix_fmt,bit_rate:stream_disposition=attached_pic", "-of", "json"])
        .arg(input)
        .output()
        .map_err(|e| format!("ffprobe failed: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(err.lines().last().unwrap_or("ffprobe failed").trim().to_string());
    }
    let parsed: ProbeOut = serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())?;
    let first = |kind: &str| {
        parsed
            .streams
            .iter()
            .filter(|s| s.codec_type.as_deref() == Some(kind))
            .find(|s| s.disposition.as_ref().map_or(true, |d| d.attached_pic == 0))
    };
    let (video, audio) = (first("video"), first("audio"));
    Ok(MediaInfo {
        duration: parsed
            .format
            .and_then(|f| f.duration)
            .and_then(|d| d.parse().ok())
            .unwrap_or(0.0),
        video: video.and_then(|s| s.codec_name.clone()),
        audio: audio.and_then(|s| s.codec_name.clone()),
        pix_fmt: video.and_then(|s| s.pix_fmt.clone()),
        audio_bitrate: audio.and_then(|s| s.bit_rate.as_deref()).and_then(|b| b.parse().ok()),
    })
}
