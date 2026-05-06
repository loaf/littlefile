pub fn validate_font(data: &[u8]) -> Result<(), String> {
    if data.len() < 4 { return Err("File is too small to be a valid font".to_string()); }
    match &data[0..4] {
        [0x00, 0x01, 0x00, 0x00] | [0x74, 0x74, 0x63, 0x66] | [0x74, 0x72, 0x75, 0x65] | [0x4F, 0x54, 0x54, 0x4F] => Ok(()),
        _ => Err("Not a valid TTF/OTF font file".to_string()),
    }
}
