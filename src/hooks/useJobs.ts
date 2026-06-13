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

export function useJobs() {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const response = await fetch(`${API_URL}/jobs`);
        if (!response.ok) {
          throw new Error('Failed to fetch jobs');
        }
        const result = await response.json();
        if (result.success && result.data) {
          const mappedJobs = result.data.map((job: any) => {
            const category = mapJobTypeToCategory(job.job_type);
            const categoryLabel = job.job_type || 'Khác';
            const slug = String(job.campaign_code || job.id || '').toLowerCase();

            return {
              id: job.campaign_code,
              slug,
              category,
              categoryLabel,
              title: job.title,
              salary: job.salary_text,
              province: job.province || 'N/A',
              district: job.district || 'N/A',
              address: job.location || '',
              shift: job.shift_text,
              companyPublicName: job.company_name,
              companyCode: job.company_code,
              targetCode: job.campaign_code,
              tags: [],
              isFeatured: false
            } as JobPost;
          });
          setJobs(mappedJobs);
        } else {
          setJobs([]);
        }
      } catch (err: any) {
        console.error('Error fetching jobs:', err);
        setError(err.message || 'Error fetching jobs');
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  return { jobs, loading, error };
}
