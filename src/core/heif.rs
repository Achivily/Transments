//! HEIC / AVIF through libheif (x265 + libde265 for HEVC, aom for AV1).

use std::path::Path;

use image::{DynamicImage, RgbaImage};
use libheif_rs::{
    Channel, ColorSpace, CompressionFormat, EncoderQuality, HeifContext, Image, LibHeif, RgbChroma,
};

type BoxError = Box<dyn std::error::Error + Send + Sync>;

pub fn decode(path: &Path) -> Result<DynamicImage, BoxError> {
    let lib = LibHeif::new();
    // libheif opens paths with the ANSI code page on Windows; go through memory for Unicode paths.
    let bytes = std::fs::read(path)?;
    let ctx = HeifContext::read_from_bytes(&bytes)?;
    let handle = ctx.primary_image_handle()?;
    let img = lib.decode(&handle, ColorSpace::Rgb(RgbChroma::Rgba), None)?;
    let planes = img.planes();
    let plane = planes.interleaved.ok_or("HEIF decode returned no pixels")?;
    let (w, h) = (plane.width as usize, plane.height as usize);
    let mut rgba = Vec::with_capacity(w * h * 4);
    for row in plane.data.chunks(plane.stride).take(h) {
        rgba.extend_from_slice(&row[..w * 4]);
    }
    let buf = RgbaImage::from_raw(w as u32, h as u32, rgba).ok_or("HEIF buffer size mismatch")?;
    Ok(DynamicImage::ImageRgba8(buf))
}

pub fn encode(rgba: &RgbaImage, out: &Path, format: &str, lossless: bool) -> Result<(), BoxError> {
    let (w, h) = rgba.dimensions();
    let mut img = Image::new(w, h, ColorSpace::Rgb(RgbChroma::Rgba))?;
    img.create_plane(Channel::Interleaved, w, h, 8)?;
    {
        let mut planes = img.planes_mut();
        let plane = planes.interleaved.as_mut().ok_or("HEIF plane allocation failed")?;
        let stride = plane.stride;
        for (y, src) in rgba.as_raw().chunks_exact(w as usize * 4).enumerate() {
            plane.data[y * stride..][..src.len()].copy_from_slice(src);
        }
    }

    let lib = LibHeif::new();
    let (codec, quality) = match format {
        "avif" => (CompressionFormat::Av1, if lossless { EncoderQuality::LossLess } else { EncoderQuality::Lossy(80) }),
        // HEVC lossless (4:4:4) is not decodable by most viewers, so HEIC is always high-quality lossy.
        _ => (CompressionFormat::Hevc, EncoderQuality::Lossy(90)),
    };
    let mut encoder = lib.encoder_for_format(codec)?;
    encoder.set_quality(quality)?;
    let mut ctx = HeifContext::new()?;
    ctx.encode_image(&img, &mut encoder, None)?;
    std::fs::write(out, ctx.write_to_bytes()?)?;
    Ok(())
}
