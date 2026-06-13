export const VIETNAM_LOCATION_OPTIONS: Record<string, string[]> = {
  'TP.HCM': [
    'Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7', 'Quận 8', 'Quận 10', 'Quận 11', 'Quận 12',
    'Bình Thạnh', 'Gò Vấp', 'Phú Nhuận', 'Tân Bình', 'Tân Phú', 'Bình Tân',
    'Thành phố Thủ Đức', 'Bình Chánh', 'Hóc Môn', 'Củ Chi', 'Nhà Bè', 'Cần Giờ'
  ],
  'Hà Nội': ['Ba Đình', 'Hoàn Kiếm', 'Tây Hồ', 'Long Biên', 'Cầu Giấy', 'Đống Đa', 'Hai Bà Trưng', 'Hoàng Mai', 'Thanh Xuân', 'Nam Từ Liêm', 'Bắc Từ Liêm', 'Hà Đông'],
  'Bình Dương': ['Thủ Dầu Một', 'Dĩ An', 'Thuận An', 'Tân Uyên', 'Bến Cát', 'Bắc Tân Uyên', 'Bàu Bàng', 'Dầu Tiếng', 'Phú Giáo'],
  'Đồng Nai': ['Biên Hòa', 'Long Khánh', 'Nhơn Trạch', 'Long Thành', 'Trảng Bom', 'Vĩnh Cửu', 'Thống Nhất', 'Xuân Lộc', 'Cẩm Mỹ'],
  'Long An': ['Tân An', 'Bến Lức', 'Đức Hòa', 'Cần Giuộc', 'Cần Đước', 'Thủ Thừa', 'Châu Thành', 'Tân Trụ'],
  'Tây Ninh': ['Tây Ninh', 'Trảng Bàng', 'Gò Dầu', 'Bến Cầu', 'Dương Minh Châu', 'Châu Thành', 'Tân Biên', 'Tân Châu'],
  'Cần Thơ': ['Ninh Kiều', 'Bình Thủy', 'Cái Răng', 'Ô Môn', 'Thốt Nốt', 'Phong Điền', 'Cờ Đỏ', 'Thới Lai', 'Vĩnh Thạnh'],
  'An Giang': ['Long Xuyên', 'Châu Đốc', 'Tân Châu', 'Châu Phú', 'Châu Thành', 'Thoại Sơn', 'Tri Tôn', 'Tịnh Biên', 'An Phú'],
  'Đồng Tháp': ['Cao Lãnh', 'Sa Đéc', 'Hồng Ngự', 'Lấp Vò', 'Lai Vung', 'Tam Nông', 'Thanh Bình', 'Tháp Mười'],
  'Vĩnh Long': ['Vĩnh Long', 'Bình Minh', 'Long Hồ', 'Mang Thít', 'Tam Bình', 'Trà Ôn', 'Vũng Liêm', 'Bình Tân'],
  'Kiên Giang': ['Rạch Giá', 'Hà Tiên', 'Phú Quốc', 'Châu Thành', 'Giồng Riềng', 'Gò Quao', 'Hòn Đất', 'Kiên Lương'],
  'Cà Mau': ['Cà Mau', 'Năm Căn', 'Đầm Dơi', 'Cái Nước', 'Trần Văn Thời', 'U Minh', 'Ngọc Hiển', 'Thới Bình'],
  'Sóc Trăng': ['Sóc Trăng', 'Vĩnh Châu', 'Ngã Năm', 'Kế Sách', 'Mỹ Tú', 'Mỹ Xuyên', 'Trần Đề', 'Cù Lao Dung'],
  'Tiền Giang': ['Mỹ Tho', 'Gò Công', 'Cai Lậy', 'Châu Thành', 'Chợ Gạo', 'Cái Bè', 'Tân Phước'],
  'Bến Tre': ['Bến Tre', 'Ba Tri', 'Bình Đại', 'Châu Thành', 'Chợ Lách', 'Giồng Trôm', 'Mỏ Cày Bắc', 'Mỏ Cày Nam'],
  'Trà Vinh': ['Trà Vinh', 'Duyên Hải', 'Càng Long', 'Cầu Kè', 'Cầu Ngang', 'Châu Thành', 'Tiểu Cần', 'Trà Cú'],
  'Bạc Liêu': ['Bạc Liêu', 'Giá Rai', 'Đông Hải', 'Hòa Bình', 'Hồng Dân', 'Phước Long', 'Vĩnh Lợi'],
  'Hậu Giang': ['Vị Thanh', 'Ngã Bảy', 'Châu Thành', 'Châu Thành A', 'Long Mỹ', 'Phụng Hiệp', 'Vị Thủy']
};

export const PROVINCE_OPTIONS = Object.keys(VIETNAM_LOCATION_OPTIONS);

export function getDistrictOptions(province?: string) {
  return VIETNAM_LOCATION_OPTIONS[province || ''] || [];
}

export function normalizeProvinceName(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower.includes('hồ chí minh') || lower.includes('ho chi minh') || lower.includes('hcm') || lower.includes('tp.hcm')) return 'TP.HCM';
  if (lower.includes('hà nội') || lower.includes('ha noi')) return 'Hà Nội';
  return PROVINCE_OPTIONS.find(p => p.toLowerCase() === lower) || raw;
}

export function resolveProvinceDistrict(province?: string, district?: string) {
  return {
    province: normalizeProvinceName(province),
    district: String(district || '').trim()
  };
}
