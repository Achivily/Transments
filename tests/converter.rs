use std::path::{Path, PathBuf};

use image::{Rgba, RgbaImage};
use transments_core::image_conv::{self, ImageJob};
use transments_core::scan::{resolve_paths, scan_folder};
use transments_core::video_conv::{self, Quality, VideoJob};
use transments_core::{ffmpeg, MediaKind, Service};

fn temp_root(tag: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!("transments-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();
    root
}

fn solid(path: &Path, w: u32, h: u32, color: [u8; 4]) {
    RgbaImage::from_pixel(w, h, Rgba(color)).save(path).unwrap();
}

#[test]
fn image_scan_and_every_output_format() {
    let root = temp_root("img");
    let input = root.join("input");
    let nested = input.join("nested");
    std::fs::create_dir_all(&nested).unwrap();
    solid(&input.join("sample.png"), 8, 8, [42, 171, 238, 255]);
    solid(&nested.join("nested.png"), 4, 4, [51, 182, 121, 255]);

    let shallow = scan_folder(MediaKind::Image, &input, Some(".png"), false).unwrap();
    assert_eq!(shallow.len(), 1);
    assert_eq!(shallow[0].name, "sample.png");

    let recursive = scan_folder(MediaKind::Image, &input, Some(".png"), true).unwrap();
    assert_eq!(recursive.len(), 2);

    let dropped = resolve_paths(
        MediaKind::Image,
        &[input.to_string_lossy().into(), input.join("sample.png").to_string_lossy().into()],
        Some(".png"),
        true,
    );
    let mut names: Vec<_> = dropped.iter().map(|f| f.name.as_str()).collect();
    names.sort();
    assert_eq!(names, ["nested.png", "sample.png"]);

    let service = Service::default();
    for format in image_conv::OUTPUT_FORMATS {
        let out_dir = root.join("output").join(format);
        let job = ImageJob {
            files: shallow.clone(),
            output_format: format.to_string(),
            output_dir: out_dir.to_string_lossy().into(),
            lossless: true,
            overwrite: false,
        };
        let summary = image_conv::run(&service, &job, |_| {});
        assert!(summary.ok, "{format}: {:?}", summary.error);
        assert_eq!(summary.succeeded, 1, "{format}: {:?}", summary.results);
        let out = out_dir.join(format!("sample{}", image_conv::ext_for(format)));
        assert!(out.exists(), "{format}");

        // Round trip: every output must decode back to the same size.
        let back = image_conv::read_input(&out).unwrap();
        assert_eq!((back.width(), back.height()), (8, 8), "{format}");

        // Second run without overwrite must refuse.
        let again = image_conv::run(&service, &job, |_| {});
        assert_eq!(again.failed, 1, "{format}");
    }

    // Lossless WebP/PNG/AVIF keep pixels exactly.
    for format in ["png", "webp", "tiff", "avif"] {
        let out = root.join("output").join(format).join(format!("sample{}", image_conv::ext_for(format)));
        let px = image_conv::read_input(&out).unwrap().to_rgba8();
        assert_eq!(px.get_pixel(3, 3).0, [42, 171, 238, 255], "{format}");
    }

    // Relative folder structure is preserved.
    let job = ImageJob {
        files: recursive,
        output_format: "jpeg".into(),
        output_dir: root.join("tree").to_string_lossy().into(),
        lossless: false,
        overwrite: true,
    };
    assert_eq!(image_conv::run(&service, &job, |_| {}).succeeded, 2);
    assert!(root.join("tree").join("nested").join("nested.jpg").exists());

    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn unicode_paths_and_heic_input() {
    let root = temp_root("unicode");
    let dir = root.join("中文 目录");
    std::fs::create_dir_all(&dir).unwrap();
    solid(&dir.join("照片.png"), 16, 10, [200, 40, 40, 255]);
    let files = scan_folder(MediaKind::Image, &dir, None, false).unwrap();
    let service = Service::default();
    let to_heic = ImageJob {
        files,
        output_format: "heic".into(),
        output_dir: dir.to_string_lossy().into(),
        lossless: true,
        overwrite: true,
    };
    assert_eq!(image_conv::run(&service, &to_heic, |_| {}).succeeded, 1);

    let heics = scan_folder(MediaKind::Image, &dir, Some(".heic"), false).unwrap();
    assert_eq!(heics.len(), 1);
    let to_png = ImageJob {
        files: heics,
        output_format: "png".into(),
        output_dir: root.join("out").to_string_lossy().into(),
        lossless: true,
        overwrite: true,
    };
    let summary = image_conv::run(&service, &to_png, |_| {});
    assert_eq!(summary.succeeded, 1, "{:?}", summary.results);
    let back = image_conv::read_input(&root.join("out").join("照片.png")).unwrap();
    assert_eq!((back.width(), back.height()), (16, 10));
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn animated_gif_stays_animated_as_webp() {
    use image::codecs::gif::GifEncoder;
    use image::{Delay, Frame};
    let root = temp_root("anim");
    let gif = root.join("anim.gif");
    {
        let mut enc = GifEncoder::new(std::fs::File::create(&gif).unwrap());
        for c in [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]] {
            let frame = Frame::from_parts(RgbaImage::from_pixel(6, 6, Rgba(c)), 0, 0, Delay::from_numer_denom_ms(100, 1));
            enc.encode_frame(frame).unwrap();
        }
    }
    let out = root.join("anim.webp");
    image_conv::convert_file(&gif, &out, "webp", true).unwrap();
    let bytes = std::fs::read(&out).unwrap();
    assert!(bytes.windows(4).any(|w| w == b"ANMF"), "expected animation frames");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn video_every_output_format() {
    let Some(tools) = ffmpeg::locate() else {
        eprintln!("ffmpeg not found; skipping video conversion test");
        return;
    };
    let root = temp_root("video");
    let src = root.join("clip.mp4");
    let status = ffmpeg::command(&tools.ffmpeg)
        .args(["-v", "error", "-f", "lavfi", "-i", "testsrc=size=321x241:rate=24:duration=1", "-f", "lavfi", "-i", "sine=frequency=440:duration=1"])
        .args(["-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=320:240", "-c:a", "aac", "-shortest", "-y"])
        .arg(&src)
        .status()
        .unwrap();
    assert!(status.success());

    let files = scan_folder(MediaKind::Video, &root, None, false).unwrap();
    assert_eq!(files.len(), 1);
    let service = Service::default();
    for format in video_conv::OUTPUT_FORMATS {
        for smart_copy in [true, false] {
            let out_dir = root.join(format!("{format}-{smart_copy}"));
            let job = VideoJob {
                files: files.clone(),
                output_format: format.to_string(),
                output_dir: out_dir.to_string_lossy().into(),
                quality: Quality::Small,
                smart_copy,
                overwrite: false,
            };
            let percents = std::sync::Mutex::new(Vec::new());
            let summary = video_conv::run(&service, Some(&tools), &job, |p| {
                if let Some(v) = p.percent {
                    percents.lock().unwrap().push(v);
                }
            });
            assert_eq!(summary.succeeded, 1, "{format} copy={smart_copy}: {:?}", summary.results);
            let out = out_dir.join(format!("clip.{format}"));
            let info = ffmpeg::probe(&tools, &out).unwrap();
            assert!(info.duration > 0.5, "{format}: duration {}", info.duration);
            if *format == "mp3" {
                assert!(info.audio.is_some());
            } else {
                assert!(info.video.is_some(), "{format}");
            }
            assert_eq!(percents.lock().unwrap().last().copied(), Some(1.0), "{format}");
        }
    }
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn video_cancel_removes_partial_output() {
    let Some(tools) = ffmpeg::locate() else { return };
    let root = temp_root("cancel");
    let src = root.join("long.mkv");
    let status = ffmpeg::command(&tools.ffmpeg)
        .args(["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=20", "-c:v", "libx264", "-preset", "ultrafast", "-y"])
        .arg(&src)
        .status()
        .unwrap();
    assert!(status.success());
    let files = scan_folder(MediaKind::Video, &root, None, false).unwrap();
    let service = std::sync::Arc::new(Service::default());
    let job = VideoJob {
        files,
        output_format: "webm".into(),
        output_dir: root.join("out").to_string_lossy().into(),
        quality: Quality::High,
        smart_copy: false,
        overwrite: true,
    };
    let canceller = service.clone();
    let summary = video_conv::run(&service, Some(&tools), &job, move |p| {
        if p.percent.is_some_and(|v| v > 0.0) {
            canceller.cancel();
        }
    });
    assert!(summary.cancelled);
    assert_eq!(summary.succeeded, 0);
    assert!(!root.join("out").join("long.webm").exists());
    let _ = std::fs::remove_dir_all(&root);
}

fn ffprobe_field(tools: &ffmpeg::Tools, file: &Path, entry: &str) -> String {
    let out = ffmpeg::command(&tools.ffprobe)
        .args(["-v", "error", "-select_streams", "v:0", "-show_entries", entry, "-of", "default=nw=1:nk=1"])
        .arg(file)
        .output()
        .unwrap();
    String::from_utf8_lossy(&out.stdout).replace('\r', "").trim().to_string()
}

#[test]
fn compress_hits_target_size_and_keeps_picture_format() {
    use transments_core::compress::{self, Codec, CompressJob, Target, MIB};
    let Some(tools) = ffmpeg::locate() else { return };
    let root = temp_root("compress");
    let dir = root.join("源 视频");
    std::fs::create_dir_all(&dir).unwrap();
    // High-bitrate 10-bit 721x405 source with stereo audio (odd width on purpose).
    let src = dir.join("clip.mov");
    let status = ffmpeg::command(&tools.ffmpeg)
        .args(["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=722x406:rate=30:duration=8", "-f", "lavfi", "-i", "sine=frequency=330:duration=8"])
        .args(["-c:v", "libx264", "-preset", "ultrafast", "-qp", "4", "-pix_fmt", "yuv420p10le", "-c:a", "aac", "-b:a", "160k", "-shortest", "-y"])
        .arg(&src)
        .status()
        .unwrap();
    assert!(status.success());
    let src_size = std::fs::metadata(&src).unwrap().len();
    assert!(src_size > 6 << 20, "source should be big: {src_size}");
    let files = scan_folder(MediaKind::Compress, &dir, None, false).unwrap();
    let service = Service::default();

    for (codec, target, container, want_ext) in [
        (Codec::Hevc, Target::Megabytes(2.0), "mp4", "mp4"),
        (Codec::H264, Target::Ratio(0.25), "keep", "mov"),
        (Codec::Hevc, Target::Megabytes(1.5), "mkv", "mkv"),
    ] {
        let out_dir = root.join(format!("out-{codec:?}-{want_ext}"));
        let job = CompressJob {
            files: files.clone(),
            output_dir: out_dir.to_string_lossy().into(),
            target,
            codec,
            container: container.into(),
            overwrite: false,
        };
        let summary = compress::run(&service, Some(&tools), &job, |_| {});
        assert_eq!(summary.succeeded, 1, "{codec:?} {target:?}: {:?}", summary.results);
        let out = out_dir.join(format!("clip.{want_ext}"));
        let size = std::fs::metadata(&out).unwrap().len();
        let limit = compress::target_bytes(target, src_size).unwrap();
        assert!(size <= limit, "{codec:?}: {size} > {limit}");
        assert!(size as f64 > limit as f64 * 0.7, "{codec:?}: budget badly underused, {size} of {limit}");
        assert_eq!(summary.results[0].output_size, Some(size));
        // Resolution (rounded to even) and frame rate are untouched.
        assert_eq!(ffprobe_field(&tools, &out, "stream=width,height"), "722\n406");
        assert_eq!(ffprobe_field(&tools, &out, "stream=r_frame_rate"), "30/1");
        let pix = ffprobe_field(&tools, &out, "stream=pix_fmt");
        if codec == Codec::Hevc {
            assert_eq!(pix, "yuv420p10le", "10-bit kept");
        }
        let info = ffmpeg::probe(&tools, &out).unwrap();
        assert!(info.audio.is_some());
        assert!((info.duration - 8.0).abs() < 0.2, "{}", info.duration);
        eprintln!("{codec:?} {target:?}: {:.2} MB of {:.2} MB", size as f64 / MIB, limit as f64 / MIB);
    }

    // Output next to the source never overwrites it.
    let job = CompressJob {
        files: files.clone(),
        output_dir: dir.to_string_lossy().into(),
        target: Target::Ratio(0.5),
        codec: Codec::H264,
        container: "keep".into(),
        overwrite: false,
    };
    assert_eq!(compress::run(&service, Some(&tools), &job, |_| {}).succeeded, 1);
    assert!(dir.join("clip_compressed.mov").exists());
    assert_eq!(std::fs::metadata(&src).unwrap().len(), src_size);

    // Already under the target: streams are copied, not re-encoded.
    let job = CompressJob { target: Target::Megabytes(500.0), output_dir: root.join("copy").to_string_lossy().into(), ..job };
    let summary = compress::run(&service, Some(&tools), &job, |_| {});
    assert_eq!(summary.succeeded, 1);
    assert_eq!(ffprobe_field(&tools, &root.join("copy").join("clip.mov"), "stream=codec_name"), "h264");

    // Impossible target is refused with a useful message.
    let job = CompressJob { target: Target::Megabytes(0.01), output_dir: root.join("tiny").to_string_lossy().into(), ..job };
    let summary = compress::run(&service, Some(&tools), &job, |_| {});
    assert_eq!(summary.failed, 1);
    assert!(summary.results[0].error.as_deref().unwrap().contains("needs at least"));
    let _ = std::fs::remove_dir_all(&root);
}
