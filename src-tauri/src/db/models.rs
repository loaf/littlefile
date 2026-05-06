#[derive(Debug, Clone)]
pub struct FileRecord {
    pub id: i64,
    pub filename: String,
    pub author: String,
    pub original_path: String,
    pub size: i64,
    pub compressed_size: i64,
    pub encoding: String,
    pub description: String,
    pub sha256: String,
    pub last_read_line: i64,
    pub is_read: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct TagRecord {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct LibraryInfo {
    pub name: String,
    pub description: String,
    pub total_files: i64,
    pub total_size: i64,
    pub total_compressed_size: i64,
    pub total_tags: i64,
    pub db_file_size: i64,
    pub created_at: String,
}
