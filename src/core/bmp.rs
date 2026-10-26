/// 24-bit bottom-up BMP, same layout the 1.x app wrote (alpha dropped).
pub fn encode_bmp24(rgb: &[u8], width: u32, height: u32) -> Vec<u8> {
    const HEADER: usize = 54;
    let (w, h) = (width as usize, height as usize);
    let stride = (w * 3).div_ceil(4) * 4;
    let pixels = stride * h;
    let file_size = HEADER + pixels;
    let mut out = vec![0u8; file_size];

    out[0..2].copy_from_slice(b"BM");
    out[2..6].copy_from_slice(&(file_size as u32).to_le_bytes());
    out[10..14].copy_from_slice(&(HEADER as u32).to_le_bytes());
    out[14..18].copy_from_slice(&40u32.to_le_bytes());
    out[18..22].copy_from_slice(&(width as i32).to_le_bytes());
    out[22..26].copy_from_slice(&(height as i32).to_le_bytes());
    out[26..28].copy_from_slice(&1u16.to_le_bytes());
    out[28..30].copy_from_slice(&24u16.to_le_bytes());
    out[34..38].copy_from_slice(&(pixels as u32).to_le_bytes());

    for y in 0..h {
        let src_row = &rgb[(h - 1 - y) * w * 3..][..w * 3];
        let dst_row = &mut out[HEADER + y * stride..][..w * 3];
        for (dst, src) in dst_row.chunks_exact_mut(3).zip(src_row.chunks_exact(3)) {
            dst[0] = src[2];
            dst[1] = src[1];
            dst[2] = src[0];
        }
    }
    out
}

#[cfg(test)]
mod tests {
    #[test]
    fn header_and_padding() {
        let bmp = super::encode_bmp24(&[255, 0, 0, 0, 255, 0, 0, 0, 255], 3, 1);
        assert_eq!(&bmp[0..2], b"BM");
        assert_eq!(bmp.len(), 54 + 12);
        assert_eq!(&bmp[54..63], &[0, 0, 255, 0, 255, 0, 255, 0, 0]);
    }
}
