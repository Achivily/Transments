//! Compress any video to a chosen file size while keeping resolution, frame rate and bit depth.
//!
//! The bitrate budget is derived from the target size and duration, then spent by a two-pass
//! encode (x265 or x264) so complex scenes get the bits; if the result still overshoots, the
//! second pass is repeated with a proportionally lower bitrate.

use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use serde::Deserialize;

use crate::ffmpeg::{self, MediaInfo, Tools};
use crate::scan::{extension, FileItem};
use crate::video_conv::{same_file, transcode, transcode_in};
use crate::{output_path, Progress, Service, Summary};

pub const MIB: f64 = 1024.0 * 1024.0;
/// Below this the picture visibly falls apart at original resolution, so we refuse instead.
const MIN_VIDEO_BPS: f64 = 64_000.0;
/// Share of the budget reserved for container overhead.
const MUX_OVERHEAD: f64 = 0.02;

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(tag = "kind", content = "value", rename_all = "lowercase")]
pub enum Target {
    /// Fraction of the source file size (0.5 = half).
    Ratio(f64),
    /// Absolute size in MiB (what Explorer calls MB).
    Megabytes(f64),
}

#[derive(Debug, Clone, Copy, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Codec {
    #[default]
    Hevc,
    H264,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressJob {
    pub files: Vec<FileItem>,
    pub output_dir: String,
    pub target: Target,
    #[serde(default)]
    pub codec: Codec,
    /// "mp4" | "mkv" | "keep" (same as source when it can hold the codec, else mp4).
    #[serde(default = "default_container")]
    pub container: String,
    #[serde(default)]
    pub overwrite: bool,
}

fn default_container() -> String {
    "mp4".into()
}

#[derive(Debug, Clone, PartialEq)]
pub enum Audio {
    None,
    Copy(u64),
    Aac(u64),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Plan {
    pub target_bytes: u64,
    /// The source already fits: remux instead of re-encoding.
    pub copy_only: bool,
    pub video_bps: u64,
    pub audio: Audio,
}

impl Audio {
    fn bps(&self) -> u64 {
        match self {
            Audio::None => 0,
            Audio::Copy(b) | Audio::Aac(b) => *b,
        }
    }
}

pub fn container_for(source_ext: &str, choice: &str) -> &'static str {
    match choice {
        "mkv" => "mkv",
        "keep" => match source_ext {
            "mkv" => "mkv",
            "mov" => "mov",
            "m4v" => "m4v",
            _ => "mp4",
        },
        _ => "mp4",
    }
}

fn audio_copyable(container: &str, codec: &str) -> bool {
    match container {
        "mkv" => matches!(codec, "aac" | "mp3" | "ac3" | "eac3" | "opus" | "vorbis"),
        _ => matches!(codec, "aac" | "mp3" | "ac3" | "eac3"),
    }
}

pub fn target_bytes(target: Target, source_size: u64) -> Result<u64, String> {
    let bytes = match target {
        Target::Ratio(r) if r > 0.0 && r < 1.0 => source_size as f64 * r,
        Target::Megabytes(mb) if mb > 0.0 => mb * MIB,
        _ => return Err("Invalid target size".into()),
    };
    Ok(bytes.round() as u64)
}

pub fn plan(source_size: u64, info: &MediaInfo, target: Target, container: &str) -> Result<Plan, String> {
    if info.video.is_none() {
        return Err("No video stream".into());
    }
    if info.duration <= 0.0 {
        return Err("Unknown duration".into());
    }
    let target_bytes = target_bytes(target, source_size)?;
    let budget_bps = target_bytes as f64 * 8.0 * (1.0 - MUX_OVERHEAD) / info.duration;
    let audio = match info.audio.as_deref() {
        None => Audio::None,
        Some(codec) => match info.audio_bitrate {
            Some(b) if audio_copyable(container, codec) && b <= 192_000 && (b as f64) <= budget_bps * 0.2 => Audio::Copy(b),
            // Spend at most ~15% of the budget on sound, between 48 and 128 kbps.
            _ => Audio::Aac(((budget_bps * 0.15).clamp(48_000.0, 128_000.0) / 8_000.0).round() as u64 * 8_000),
        },
    };
    let copy_only = source_size <= target_bytes;
    let video_bps = budget_bps - audio.bps() as f64;
    if !copy_only && video_bps < MIN_VIDEO_BPS {
        let needed = (MIN_VIDEO_BPS + audio.bps() as f64) * info.duration / 8.0 / (1.0 - MUX_OVERHEAD);
        return Err(format!("Target too small for this video; needs at least {:.1} MB", needed / MIB));
    }
    Ok(Plan { target_bytes, copy_only, video_bps: video_bps.max(0.0) as u64, audio })
}

fn is_high_bit_depth(pix_fmt: Option<&str>) -> bool {
    pix_fmt.is_some_and(|p| p.contains("10") || p.contains("12"))
}

fn video_args(codec: Codec, info: &MediaInfo, container: &str, bps: u64, pass: u8) -> Vec<String> {
    let mut args: Vec<String> = ["-map", "0:V:0", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    let kbps = format!("{}k", bps / 1000);
    match codec {
        Codec::Hevc => {
            let pix = if is_high_bit_depth(info.pix_fmt.as_deref()) { "yuv420p10le" } else { "yuv420p" };
            args.extend(
                ["-c:v", "libx265", "-preset", "medium", "-b:v", &kbps, "-pix_fmt", pix, "-x265-params"]
                    .map(String::from),
            );
            args.push(format!("pass={pass}:stats=t2p.log:log-level=error"));
            if matches!(container, "mp4" | "m4v" | "mov") {
                args.extend(["-tag:v", "hvc1"].map(String::from));
            }
        }
        Codec::H264 => {
            args.extend(
                ["-c:v", "libx264", "-preset", "medium", "-b:v", &kbps, "-pix_fmt", "yuv420p", "-pass", &pass.to_string(), "-passlogfile", "t2p"]
                    .map(String::from),
            );
        }
    }
    args
}

fn final_args(codec: Codec, info: &MediaInfo, container: &str, plan: &Plan, video_bps: u64) -> Vec<String> {
    let mut args = video_args(codec, info, container, video_bps, 2);
    match &plan.audio {
        Audio::None => {}
        Audio::Copy(_) => args.extend(["-map", "0:a:0", "-c:a", "copy"].map(String::from)),
        Audio::Aac(b) => {
            args.extend(["-map", "0:a:0", "-c:a", "aac"].map(String::from));
            args.extend(["-b:a".to_string(), format!("{}k", b / 1000)]);
        }
    }
    args.extend(["-map_metadata", "0", "-map_chapters", "0"].map(String::from));
    if container != "mkv" {
        args.extend(["-movflags", "+faststart"].map(String::from));
    }
    args
}

fn null_sink() -> &'static Path {
    Path::new(if cfg!(windows) { "NUL" } else { "/dev/null" })
}

pub fn run(service: &Service, tools: Option<&Tools>, job: &CompressJob, progress: impl Fn(Progress) + Sync) -> Summary {
    if job.files.is_empty() {
        return Summary::error("No input files");
    }
    if job.output_dir.is_empty() {
        return Summary::error("No output folder");
    }
    if let Err(e) = target_bytes(job.target, 1 << 20) {
        return Summary::error(e);
    }
    let Some(tools) = tools else { return Summary::error("FFmpeg not found") };
    let cancel = service.cancel_flag();
    let progress = &progress;
    let total = job.files.len();
    service.run(
        &job.files,
        &job.output_dir,
        1,
        |i, file| {
            compress_one(tools, i, file, job, &cancel, &|percent| {
                progress(Progress {
                    index: i,
                    total,
                    file: file.name.clone(),
                    path: file.path.clone(),
                    status: "running",
                    message: None,
                    percent: Some(percent),
                    output_size: None,
                })
            })
        },
        progress,
    )
}

fn compress_one(
    tools: &Tools,
    index: usize,
    file: &FileItem,
    job: &CompressJob,
    cancel: &AtomicBool,
    on_percent: &dyn Fn(f64),
) -> Result<String, String> {
    let input = Path::new(&file.path);
    let container = container_for(&extension(input), &job.container);
    let out = compressed_path(file, &job.output_dir, container, job.overwrite)?;
    let info = ffmpeg::probe(tools, input)?;
    let source_size = std::fs::metadata(input).map_err(|e| e.to_string())?.len();
    let plan = plan(source_size, &info, job.target, container)?;
    on_percent(0.0);

    let result = if plan.copy_only {
        let mut args: Vec<String> = ["-map", "0:V:0", "-map", "0:a:0?", "-c", "copy", "-map_metadata", "0"].map(String::from).to_vec();
        if matches!(container, "mp4" | "m4v" | "mov") && info.video.as_deref() == Some("hevc") {
            args.extend(["-tag:v", "hvc1"].map(String::from));
        }
        transcode(tools, input, &out, &args, info.duration, cancel, on_percent)
    } else {
        two_pass(tools, index, input, &out, &info, &plan, job.codec, container, cancel, on_percent)
    };
    if result.is_err() {
        let _ = std::fs::remove_file(&out);
    }
    result.map(|_| out.to_string_lossy().into_owned())
}

#[allow(clippy::too_many_arguments)]
fn two_pass(
    tools: &Tools,
    index: usize,
    input: &Path,
    out: &Path,
    info: &MediaInfo,
    plan: &Plan,
    codec: Codec,
    container: &str,
    cancel: &AtomicBool,
    on_percent: &dyn Fn(f64),
) -> Result<(), String> {
    let stats = std::env::temp_dir().join(format!("transments-2pass-{}-{index}", std::process::id()));
    std::fs::create_dir_all(&stats).map_err(|e| e.to_string())?;
    let result = (|| {
        let mut pass1 = video_args(codec, info, container, plan.video_bps, 1);
        pass1.extend(["-an", "-sn", "-f", "null"].map(String::from));
        transcode_in(tools, Some(&stats), input, null_sink(), &pass1, info.duration, cancel, &|p| on_percent(p * 0.4))?;

        let audio_bytes = plan.audio.bps() as f64 * info.duration / 8.0;
        let mut video_bps = plan.video_bps;
        for attempt in 0..3 {
            let args = final_args(codec, info, container, plan, video_bps);
            transcode_in(tools, Some(&stats), input, out, &args, info.duration, cancel, &|p| on_percent(0.4 + p * 0.6))?;
            let actual = std::fs::metadata(out).map_err(|e| e.to_string())?.len();
            if actual <= plan.target_bytes {
                return Ok(());
            }
            if attempt == 2 {
                return Err(format!("Could not reach the target size ({:.1} MB)", actual as f64 / MIB));
            }
            // Shrink only the video share, with a little extra headroom.
            let scale = (plan.target_bytes as f64 - audio_bytes) * 0.97 / (actual as f64 - audio_bytes).max(1.0);
            video_bps = ((video_bps as f64 * scale.clamp(0.3, 0.99)) as u64).max(MIN_VIDEO_BPS as u64);
        }
        Ok(())
    })();
    let _ = std::fs::remove_dir_all(&stats);
    result
}

/// Same naming as conversions, but never on top of the source: `clip.mp4` -> `clip_compressed.mp4`.
fn compressed_path(file: &FileItem, output_dir: &str, container: &str, overwrite: bool) -> Result<PathBuf, String> {
    let ext = format!(".{container}");
    let probe = output_path(file, output_dir, &ext, true)?;
    if !same_file(Path::new(&file.path), &probe) {
        return output_path(file, output_dir, &ext, overwrite);
    }
    let mut renamed = file.clone();
    let src = Path::new(&file.path);
    let stem = src.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    renamed.path = src.with_file_name(format!("{stem}_compressed{ext}")).to_string_lossy().into_owned();
    output_path(&renamed, output_dir, &ext, overwrite)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info(duration: f64, audio: Option<(&str, u64)>) -> MediaInfo {
        MediaInfo {
            duration,
            video: Some("h264".into()),
            audio: audio.map(|a| a.0.into()),
            audio_bitrate: audio.map(|a| a.1),
            pix_fmt: Some("yuv420p".into()),
        }
    }

    #[test]
    fn budget_splits_video_and_audio() {
        // 100 s, 25 MiB target: ~2.06 Mbps total.
        let p = plan(200 << 20, &info(100.0, Some(("aac", 128_000))), Target::Megabytes(25.0), "mp4").unwrap();
        assert!(!p.copy_only);
        assert_eq!(p.audio, Audio::Copy(128_000));
        let total = (p.video_bps + p.audio.bps()) as f64 * 100.0 / 8.0;
        assert!(total < 25.0 * MIB && total > 24.0 * MIB, "{total}");
    }

    #[test]
    fn tiny_budget_reencodes_audio_and_rejects_impossible() {
        let p = plan(50 << 20, &info(60.0, Some(("flac", 900_000))), Target::Megabytes(2.0), "mp4").unwrap();
        assert!(matches!(p.audio, Audio::Aac(b) if b <= 48_000));
        assert!(plan(50 << 20, &info(3600.0, None), Target::Megabytes(1.0), "mp4").is_err());
    }

    #[test]
    fn already_small_is_copied() {
        let p = plan(5 << 20, &info(10.0, None), Target::Megabytes(25.0), "mp4").unwrap();
        assert!(p.copy_only);
        assert!(target_bytes(Target::Ratio(1.5), 10).is_err());
    }
}
