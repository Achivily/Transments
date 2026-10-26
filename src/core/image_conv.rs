use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::Path;

use image::codecs::gif::{GifDecoder, GifEncoder};
use image::codecs::webp::WebPDecoder;
use image::{AnimationDecoder, DynamicImage, ExtendedColorType, Frame, ImageFormat, ImageReader};
use serde::Deserialize;

use crate::scan::{extension, FileItem};
use crate::{bmp, default_workers, output_path, Progress, Service, Summary};

pub const OUTPUT_FORMATS: &[&str] = &["png", "jpeg", "webp", "tiff", "avif", "gif", "bmp", "heic"];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageJob {
    pub files: Vec<FileItem>,
    pub output_format: String,
    pub output_dir: String,
    #[serde(default = "yes")]
    pub lossless: bool,
    #[serde(default)]
    pub overwrite: bool,
}

fn yes() -> bool {
    true
}

pub fn ext_for(format: &str) -> &'static str {
    match format {
        "png" => ".png",
        "jpeg" => ".jpg",
        "webp" => ".webp",
        "tiff" => ".tiff",
        "avif" => ".avif",
        "gif" => ".gif",
        "bmp" => ".bmp",
        _ => ".heic",
    }
}

pub fn run(service: &Service, job: &ImageJob, progress: impl Fn(Progress) + Sync) -> Summary {
    if job.files.is_empty() {
        return Summary::error("No input files");
    }
    if job.output_dir.is_empty() {
        return Summary::error("No output folder");
    }
    if !OUTPUT_FORMATS.contains(&job.output_format.as_str()) {
        return Summary::error(format!("Unsupported output format: {}", job.output_format));
    }
    #[cfg(not(feature = "heif"))]
    if matches!(job.output_format.as_str(), "heic" | "avif") {
        return Summary::error("This build has no HEIC/AVIF support");
    }
    service.run(
        &job.files,
        &job.output_dir,
        default_workers(),
        |_, file| convert_one(file, job),
        progress,
    )
}

fn convert_one(file: &FileItem, job: &ImageJob) -> Result<String, String> {
    let out = output_path(file, &job.output_dir, ext_for(&job.output_format), job.overwrite)?;
    convert_file(Path::new(&file.path), &out, &job.output_format, job.lossless).map_err(|e| e.to_string())?;
    Ok(out.to_string_lossy().into_owned())
}

type BoxError = Box<dyn std::error::Error + Send + Sync>;

pub fn convert_file(input: &Path, out: &Path, format: &str, lossless: bool) -> Result<(), BoxError> {
    // Animated GIF/WebP stays animated only when the target is WebP; other targets take the first frame.
    if format == "webp" {
        if let Some(frames) = read_animation(input)? {
            return write_animated_webp(&frames, out, lossless);
        }
    }
    let img = read_input(input)?;
    write_image(&img, out, format, lossless)
}

pub fn read_input(path: &Path) -> Result<DynamicImage, BoxError> {
    let ext = extension(path);
    if matches!(ext.as_str(), "heic" | "heif" | "avif") {
        #[cfg(feature = "heif")]
        return crate::heif::decode(path);
        #[cfg(not(feature = "heif"))]
        return Err("This build has no HEIC/AVIF support".into());
    }
    let mut reader = ImageReader::open(path)?.with_guessed_format()?;
    reader.no_limits();
    Ok(reader.decode()?)
}

fn read_animation(path: &Path) -> Result<Option<Vec<Frame>>, BoxError> {
    let reader = || -> Result<BufReader<File>, BoxError> { Ok(BufReader::new(File::open(path)?)) };
    let frames = match extension(path).as_str() {
        "gif" => GifDecoder::new(reader()?)?.into_frames().collect_frames()?,
        "webp" => {
            let decoder = WebPDecoder::new(reader()?)?;
            if !decoder.has_animation() {
                return Ok(None);
            }
            decoder.into_frames().collect_frames()?
        }
        _ => return Ok(None),
    };
    Ok((frames.len() > 1).then_some(frames))
}

pub fn write_image(img: &DynamicImage, out: &Path, format: &str, lossless: bool) -> Result<(), BoxError> {
    let (w, h) = (img.width(), img.height());
    match format {
        "png" => {
            img.write_to(&mut BufWriter::new(File::create(out)?), ImageFormat::Png)?;
        }
        "jpeg" => {
            if w > u16::MAX as u32 || h > u16::MAX as u32 {
                return Err("Image too large for JPEG".into());
            }
            let rgb = img.to_rgb8();
            let mut enc = jpeg_encoder::Encoder::new_file(out, 100)?;
            enc.set_sampling_factor(jpeg_encoder::SamplingFactor::R_4_4_4);
            enc.set_optimized_huffman_tables(true);
            enc.encode(&rgb, w as u16, h as u16, jpeg_encoder::ColorType::Rgb)?;
        }
        "webp" => {
            let rgba = img.to_rgba8();
            let enc = webp::Encoder::from_rgba(&rgba, w, h);
            let data = if lossless { enc.encode_lossless() } else { enc.encode(90.0) };
            std::fs::write(out, &*data)?;
        }
        "tiff" => {
            let rgba = img.to_rgba8();
            let mut enc = tiff::encoder::TiffEncoder::new(BufWriter::new(File::create(out)?))?
                .with_compression(tiff::encoder::Compression::Lzw)
                .with_predictor(tiff::tags::Predictor::Horizontal);
            enc.write_image::<tiff::encoder::colortype::RGBA8>(w, h, &rgba)?;
        }
        "gif" => {
            let rgba = img.to_rgba8();
            let mut enc = GifEncoder::new_with_speed(BufWriter::new(File::create(out)?), 5);
            enc.encode(&rgba, w, h, ExtendedColorType::Rgba8)?;
        }
        "bmp" => {
            let rgb = img.to_rgb8();
            std::fs::write(out, bmp::encode_bmp24(&rgb, w, h))?;
        }
        #[cfg(feature = "heif")]
        "heic" | "avif" => crate::heif::encode(&img.to_rgba8(), out, format, lossless)?,
        other => return Err(format!("Unsupported output format: {other}").into()),
    }
    Ok(())
}

fn write_animated_webp(frames: &[Frame], out: &Path, lossless: bool) -> Result<(), BoxError> {
    let first = frames[0].buffer();
    let (w, h) = (first.width(), first.height());
    let mut config = webp::WebPConfig::new().map_err(|_| "WebP config failed")?;
    config.lossless = lossless as i32;
    config.quality = if lossless { 75.0 } else { 90.0 };
    let mut enc = webp::AnimEncoder::new(w, h, &config);
    let mut timestamp = 0i32;
    for frame in frames {
        enc.add_frame(webp::AnimFrame::from_rgba(frame.buffer(), w, h, timestamp));
        let (num, den) = frame.delay().numer_denom_ms();
        timestamp += (num / den.max(1)).max(10) as i32;
    }
    let data = enc.try_encode().map_err(|e| format!("WebP animation encode failed: {e:?}"))?;
    std::fs::write(out, &*data)?;
    Ok(())
}
