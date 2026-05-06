use std::io::Read;

pub fn compress_zlib(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut encoder = flate2::read::ZlibEncoder::new(data, flate2::Compression::default());
    let mut buf = Vec::new();
    encoder
        .read_to_end(&mut buf)
        .map_err(|e| format!("Zlib compression failed: {e}"))?;
    Ok(buf)
}

pub fn decompress_zlib(data: &[u8]) -> Result<String, String> {
    let mut decoder = flate2::read::ZlibDecoder::new(data);
    let mut buf = Vec::new();
    decoder
        .read_to_end(&mut buf)
        .map_err(|e| format!("Zlib decompression failed: {e}"))?;
    String::from_utf8(buf).map_err(|e| format!("Decompressed data is not valid UTF-8: {e}"))
}
