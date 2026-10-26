//! Video container / codec conversion driven by an external ffmpeg process.

use std::io::{BufRead, BufReader};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use serde::Deserialize;

use crate::ffmpeg::{self, MediaInfo, Tools};
use crate::scan::FileItem;
use crate::{output_path, Progress, Service, Summary};

pub const OUTPUT_FORMATS: &[&str] = &[
    "mp4", "mkv", "mov", "webm", "avi", "flv", "wmv", "ts", "mpg", "m4v", "3gp", "gif", "mp3",
];

#[derive(Debug, Clone, Copy, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
    High,
    #[default]
    Balanced,
    Small,
}

impl Quality {
    fn pick(self, values: [&'static str; 3]) -> &'static str {
        values[self as usize]
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoJob {
    pub files: Vec<FileItem>,
    pub output_format: String,
    pub output_dir: String,
    #[serde(default)]
    pub quality: Quality,
    /// Copy streams whose codec the target container already accepts instead of re-encoding.
    #[serde(default = "yes")]
    pub smart_copy: bool,
    #[serde(default)]
    pub overwrite: bool,
}

fn yes() -> bool {
    true
}

#[derive(Clone, Copy)]
enum VideoCodec {
    X264,
    X264Baseline,
    Vp9,
    Mpeg4,
    Wmv2,
    Mpeg2,
}

#[derive(Clone, Copy)]
enum AudioCodec {
    Aac,
    Opus,
    Mp3,
    Wma,
    Mp2,
}

struct Spec {
    video: VideoCodec,
    audio: AudioCodec,
    copy_video: &'static [&'static str],
    copy_audio: &'static [&'static str],
    mux: &'static [&'static str],
}

fn spec(format: &str) -> Option<Spec> {
    use AudioCodec as A;
    use VideoCodec as V;
    const MP4_V: &[&str] = &["h264", "hevc", "av1", "mpeg4"];
    const MP4_A: &[&str] = &["aac", "mp3", "ac3", "eac3", "alac"];
    let s = |video, audio, copy_video, copy_audio, mux| Spec { video, audio, copy_video, copy_audio, mux };
    Some(match format {
        "mp4" | "m4v" => s(V::X264, A::Aac, MP4_V, MP4_A, &["-movflags", "+faststart"]),
        "mov" => s(V::X264, A::Aac, &["h264", "hevc", "prores", "mpeg4", "mjpeg"], &["aac", "mp3", "alac", "pcm_s16le", "pcm_s24le"], &["-movflags", "+faststart"]),
        "mkv" => s(
            V::X264,
            A::Aac,
            &["h264", "hevc", "av1", "vp8", "vp9", "mpeg4", "mpeg2video"],
            &["aac", "mp3", "ac3", "eac3", "opus", "vorbis", "flac", "dts", "truehd", "alac", "pcm_s16le"],
            &[],
        ),
        "webm" => s(V::Vp9, A::Opus, &["vp8", "vp9", "av1"], &["opus", "vorbis"], &[]),
        "avi" => s(V::Mpeg4, A::Mp3, &["mpeg4", "msmpeg4v3", "mjpeg"], &["mp3", "ac3", "mp2", "pcm_s16le"], &[]),
        "flv" => s(V::X264, A::Aac, &["h264"], &["aac", "mp3"], &[]),
        "wmv" => s(V::Wmv2, A::Wma, &["wmv1", "wmv2", "wmv3", "vc1"], &["wmav1", "wmav2"], &[]),
        "ts" => s(V::X264, A::Aac, &["h264", "hevc", "mpeg2video"], &["aac", "mp3", "ac3", "eac3", "mp2"], &[]),
        "mpg" => s(V::Mpeg2, A::Mp2, &["mpeg2video", "mpeg1video"], &["mp2", "mp3", "ac3"], &[]),
        "3gp" => s(V::X264Baseline, A::Aac, &["h264", "h263"], &["aac", "amr_nb"], &[]),
        _ => return None,
    })
}

fn video_args(codec: VideoCodec, q: Quality) -> Vec<&'static str> {
    // Every encoder below needs even dimensions for 4:2:0 output.
    let mut args = vec!["-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-pix_fmt", "yuv420p"];
    args.extend(match codec {
        VideoCodec::X264 => vec!["-c:v", "libx264", "-preset", "medium", "-crf", q.pick(["18", "23", "28"])],
        VideoCodec::X264Baseline => vec![
            "-c:v", "libx264", "-preset", "medium", "-profile:v", "baseline", "-crf", q.pick(["20", "24", "29"]),
        ],
        VideoCodec::Vp9 => vec![
            "-c:v", "libvpx-vp9", "-crf", q.pick(["28", "33", "38"]), "-b:v", "0", "-row-mt", "1",
            "-deadline", "good", "-cpu-used", q.pick(["2", "3", "4"]),
        ],
        VideoCodec::Mpeg4 => vec!["-c:v", "mpeg4", "-q:v", q.pick(["2", "4", "7"]), "-tag:v", "XVID"],
        VideoCodec::Wmv2 => vec!["-c:v", "wmv2", "-q:v", q.pick(["2", "4", "8"])],
        VideoCodec::Mpeg2 => vec!["-c:v", "mpeg2video", "-q:v", q.pick(["2", "4", "7"])],
    });
    args
}

fn audio_args(codec: AudioCodec, q: Quality) -> Vec<&'static str> {
    match codec {
        AudioCodec::Aac => vec!["-c:a", "aac", "-b:a", q.pick(["192k", "160k", "128k"])],
        AudioCodec::Opus => vec!["-c:a", "libopus", "-b:a", q.pick(["160k", "128k", "96k"])],
        AudioCodec::Mp3 => vec!["-c:a", "libmp3lame", "-b:a", q.pick(["256k", "192k", "128k"])],
        AudioCodec::Wma => vec!["-c:a", "wmav2", "-b:a", q.pick(["192k", "160k", "128k"])],
        AudioCodec::Mp2 => vec!["-c:a", "mp2", "-b:a", q.pick(["384k", "256k", "192k"])],
    }
}

/// ffmpeg arguments between the input and the output path.
pub fn build_args(format: &str, info: &MediaInfo, quality: Quality, smart_copy: bool) -> Result<Vec<String>, String> {
    let owned = |v: Vec<&str>| v.into_iter().map(String::from).collect::<Vec<_>>();
    match format {
        "gif" => {
            let (fps, width) = match quality {
                Quality::High => ("20", "960"),
                Quality::Balanced => ("15", "720"),
                Quality::Small => ("10", "480"),
            };
            let filter = format!(
                "[0:V:0]fps={fps},scale='min({width},iw)':-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5"
            );
            if info.video.is_none() {
                return Err("No video stream".into());
            }
            return Ok(vec!["-an".into(), "-filter_complex".into(), filter, "-loop".into(), "0".into()]);
        }
        "mp3" => {
            let Some(audio) = info.audio.as_deref() else { return Err("No audio stream".into()) };
            let mut args = owned(vec!["-map", "0:a:0", "-vn"]);
            if smart_copy && audio == "mp3" {
                args.extend(owned(vec!["-c:a", "copy"]));
            } else {
                args.extend(owned(audio_args(AudioCodec::Mp3, quality)));
            }
            return Ok(args);
        }
        _ => {}
    }

    let spec = spec(format).ok_or_else(|| format!("Unsupported output format: {format}"))?;
    let video = info.video.as_deref().ok_or("No video stream")?;
    let mut args = owned(vec!["-map", "0:V:0", "-map", "0:a:0?", "-sn", "-dn"]);
    if smart_copy && spec.copy_video.contains(&video) {
        args.extend(owned(vec!["-c:v", "copy"]));
        if video == "hevc" && matches!(format, "mp4" | "m4v" | "mov") {
            args.extend(owned(vec!["-tag:v", "hvc1"]));
        }
    } else {
        args.extend(owned(video_args(spec.video, quality)));
    }
    if let Some(audio) = info.audio.as_deref() {
        if smart_copy && spec.copy_audio.contains(&audio) {
            args.extend(owned(vec!["-c:a", "copy"]));
        } else {
            args.extend(owned(audio_args(spec.audio, quality)));
        }
    }
    args.extend(owned(spec.mux.to_vec()));
    Ok(args)
}

pub fn run(service: &Service, tools: Option<&Tools>, job: &VideoJob, progress: impl Fn(Progress) + Sync) -> Summary {
    if job.files.is_empty() {
        return Summary::error("No input files");
    }
    if job.output_dir.is_empty() {
        return Summary::error("No output folder");
    }
    if !OUTPUT_FORMATS.contains(&job.output_format.as_str()) {
        return Summary::error(format!("Unsupported output format: {}", job.output_format));
    }
    let Some(tools) = tools else { return Summary::error("FFmpeg not found") };
    let cancel = service.cancel_flag();
    let progress = &progress;
    let total = job.files.len();
    // ffmpeg already uses every core, so files are converted one at a time.
    service.run(
        &job.files,
        &job.output_dir,
        1,
        |i, file| {
            convert_one(tools, file, job, &cancel, |percent| {
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

fn convert_one(
    tools: &Tools,
    file: &FileItem,
    job: &VideoJob,
    cancel: &AtomicBool,
    on_percent: impl Fn(f64),
) -> Result<String, String> {
    let out = output_path(file, &job.output_dir, &format!(".{}", job.output_format), job.overwrite)?;
    let input = Path::new(&file.path);
    if same_file(input, &out) {
        return Err("Output would replace the source file".into());
    }
    let info = ffmpeg::probe(tools, input)?;
    let args = build_args(&job.output_format, &info, job.quality, job.smart_copy)?;
    on_percent(0.0);
    let result = transcode(tools, input, &out, &args, info.duration, cancel, &on_percent);
    if result.is_err() {
        let _ = std::fs::remove_file(&out);
    }
    result.map(|_| out.to_string_lossy().into_owned())
}

pub(crate) fn same_file(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

pub fn transcode(
    tools: &Tools,
    input: &Path,
    out: &Path,
    args: &[String],
    duration: f64,
    cancel: &AtomicBool,
    on_percent: &dyn Fn(f64),
) -> Result<(), String> {
    transcode_in(tools, None, input, out, args, duration, cancel, on_percent)
}

/// Like [`transcode`], with ffmpeg started in `cwd` (two-pass encoders write their stats there).
#[allow(clippy::too_many_arguments)]
pub fn transcode_in(
    tools: &Tools,
    cwd: Option<&Path>,
    input: &Path,
    out: &Path,
    args: &[String],
    duration: f64,
    cancel: &AtomicBool,
    on_percent: &dyn Fn(f64),
) -> Result<(), String> {
    let mut cmd = ffmpeg::command(&tools.ffmpeg);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    let mut child = cmd
        .args(["-hide_banner", "-nostdin", "-loglevel", "error", "-nostats", "-progress", "pipe:1", "-y", "-i"])
        .arg(input)
        .args(args)
        .arg(out)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not start ffmpeg: {e}"))?;

    let (tx, rx) = mpsc::channel::<f64>();
    let stdout = child.stdout.take().unwrap();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(us) = line.strip_prefix("out_time_us=").and_then(|v| v.trim().parse::<f64>().ok()) {
                let _ = tx.send(us / 1_000_000.0);
            }
        }
    });
    let stderr = child.stderr.take().unwrap();
    let errors = std::thread::spawn(move || {
        BufReader::new(stderr).lines().map_while(Result::ok).filter(|l| !l.trim().is_empty()).collect::<Vec<_>>()
    });

    let mut last_sent = (0.0f64, Instant::now());
    loop {
        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Cancelled".into());
        }
        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(seconds) if duration > 0.0 => {
                let pct = (seconds / duration).clamp(0.0, 1.0);
                if pct - last_sent.0 >= 0.01 || last_sent.1.elapsed() > Duration::from_millis(400) {
                    on_percent(pct);
                    last_sent = (pct, Instant::now());
                }
            }
            Ok(_) | Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    let errors = errors.join().unwrap_or_default();
    if status.success() {
        on_percent(1.0);
        Ok(())
    } else {
        Err(errors
            .last()
            .cloned()
            .unwrap_or_else(|| format!("ffmpeg exited with {}", status.code().unwrap_or(-1))))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info(v: &str, a: Option<&str>) -> MediaInfo {
        MediaInfo { duration: 1.0, video: Some(v.into()), audio: a.map(Into::into), ..Default::default() }
    }

    #[test]
    fn remuxes_compatible_streams() {
        let args = build_args("mkv", &info("h264", Some("aac")), Quality::Balanced, true).unwrap();
        assert!(args.windows(2).any(|w| w == ["-c:v", "copy"]));
        assert!(args.windows(2).any(|w| w == ["-c:a", "copy"]));
    }

    #[test]
    fn transcodes_incompatible_streams() {
        let args = build_args("webm", &info("h264", Some("aac")), Quality::High, true).unwrap();
        assert!(args.windows(2).any(|w| w == ["-c:v", "libvpx-vp9"]));
        assert!(args.windows(2).any(|w| w == ["-c:a", "libopus"]));
    }

    #[test]
    fn every_format_has_args() {
        for f in OUTPUT_FORMATS {
            assert!(build_args(f, &info("h264", Some("aac")), Quality::Small, false).is_ok(), "{f}");
        }
    }
}
