import { useState, useEffect } from 'react';
import type { JobPost } from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function normalizeJobType(jobType: string | null | undefined): string {
  return String(jobType || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mapJobTypeToCategory(jobType: string | null | undefined): JobPost['category'] | 'khac' {
  switch (normalizeJobType(jobType)) {
    case 'bao ve':
      return 'bao-ve';
    case 'lao dong pho thong':
      return 'lao-dong-pho-thong';
    case 'tap vu':
      return 'tap-vu';
    case 'phu kho':
      return 'phu-kho';
    case 'kho van':
      return 'kho-van';
    case 'giao hang':
      return 'giao-hang';
    default:
      return 'khac';
  }
}

// Parse JSON array từ DB hoặc trả về null
function parseJsonArray(value: string | null | undefined): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    return undefined;
  } catch {
    // Nếu không parse được JSON, thử split theo newline (cho dữ liệu dạng bullet text)
    if (typeof value === 'string' && value.includes('\n')) {
      return value.split('\n').map(line => line.replace(/^•\s*/, '').trim()).filter(Boolean);
    }
    return undefined;
  }
}

export function useJobDetail(jobId: string | undefined) {
  const [job, setJob] = useState<JobPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchJobDetail() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`${API_URL}/jobs/${encodeURIComponent(jobId!)}`);
        
        if (response.status === 404) {
          throw new Error('Không tìm thấy việc làm');
        }
        
        if (!response.ok) {
          throw new Error('Không thể tải thông tin việc làm');
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          const jobData = result.data;
          const category = mapJobTypeToCategory(jobData.job_type) as JobPost['category'];
          const categoryLabel = jobData.job_type || 'Khác';
          const slug = String(jobData.campaign_code || jobData.id || '').toLowerCase();

          setJob({
            id: jobData.campaign_code,
            slug,
            category,
            categoryLabel,
            title: jobData.title,
            salary: jobData.salary_text,
            province: jobData.province || 'N/A',
            district: jobData.district || 'N/A',
            address: jobData.location || '',
            shift: jobData.shift_text,
            companyPublicName: jobData.company_name,
            companyCode: jobData.company_code,
            targetCode: jobData.campaign_code,
            tags: [],
            isFeatured: false,
            // Chi tiết mở rộng
            description: jobData.description || undefined,
            requirements: parseJsonArray(jobData.requirements),
            benefits: parseJsonArray(jobData.benefits),
          });
        } else {
          throw new Error(result.error || 'Không thể tải thông tin việc làm');
        }
      } catch (err: any) {
        console.error('Error fetching job detail:', err);
        setError(err.message || 'Lỗi kết nối');
        setJob(null);
      } finally {
        setLoading(false);
      }
    }

    fetchJobDetail();
  }, [jobId]);

  return { job, loading, error };
}
