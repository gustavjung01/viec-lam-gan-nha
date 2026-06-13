// Job Matching Algorithm - Chatbot Phase 2
// Rule-based matching between candidates and campaigns

import { openDb } from '../database.js';

/**
 * Calculate match score between candidate and campaign
 * @param {Object} candidate - Candidate profile with extended fields
 * @param {Object} campaign - Campaign/job data
 * @returns {Object} Match result with score and breakdown
 */
export function calculateMatchScore(candidate, campaign) {
  let totalScore = 0;
  let maxScore = 100;
  let breakdown = [];
  let matchReasons = [];
  let mismatchReasons = [];

  // 1. Location Match (25 points)
  const locationScore = calculateLocationScore(candidate, campaign);
  totalScore += locationScore.score;
  breakdown.push({ factor: 'location', score: locationScore.score, max: 25, details: locationScore.details });
  if (locationScore.matched) matchReasons.push(locationScore.details);
  else if (locationScore.score === 0) mismatchReasons.push(`Khác khu vực: ${campaign.province}`);

  // 2. Job Type Match (20 points)
  const jobScore = calculateJobTypeScore(candidate, campaign);
  totalScore += jobScore.score;
  breakdown.push({ factor: 'job_type', score: jobScore.score, max: 20, details: jobScore.details });
  if (jobScore.matched) matchReasons.push(jobScore.details);

  // 3. Shift Match (15 points)
  const shiftScore = calculateShiftScore(candidate, campaign);
  totalScore += shiftScore.score;
  breakdown.push({ factor: 'shift', score: shiftScore.score, max: 15, details: shiftScore.details });
  if (shiftScore.matched) matchReasons.push(shiftScore.details);

  // 4. Experience Match (15 points)
  const expScore = calculateExperienceScore(candidate, campaign);
  totalScore += expScore.score;
  breakdown.push({ factor: 'experience', score: expScore.score, max: 15, details: expScore.details });
  if (expScore.matched) matchReasons.push(expScore.details);

  // 5. Stay-in/Transport Bonus (15 points)
  const bonusScore = calculateBonusScore(candidate, campaign);
  totalScore += bonusScore.score;
  breakdown.push({ factor: 'bonus', score: bonusScore.score, max: 15, details: bonusScore.details });
  if (bonusScore.matched) matchReasons.push(bonusScore.details);

  // 6. Availability (10 points)
  const availScore = calculateAvailabilityScore(candidate, campaign);
  totalScore += availScore.score;
  breakdown.push({ factor: 'availability', score: availScore.score, max: 10, details: availScore.details });

  // Normalize to 0-100
  const normalizedScore = Math.round(totalScore);

  // Determine match level
  let matchLevel;
  if (normalizedScore >= 80) matchLevel = 'excellent';
  else if (normalizedScore >= 60) matchLevel = 'good';
  else if (normalizedScore >= 40) matchLevel = 'fair';
  else matchLevel = 'poor';

  return {
    score: normalizedScore,
    maxScore,
    matchLevel,
    breakdown,
    matchReasons,
    mismatchReasons,
    isRecommended: normalizedScore >= 60
  };
}

function calculateLocationScore(candidate, campaign) {
  if (!candidate.province || !campaign.province) {
    return { score: 10, max: 25, matched: false, details: 'Chưa có thông tin địa điểm' };
  }

  const candidateProv = normalizeText(candidate.province);
  const campaignProv = normalizeText(campaign.province);

  // Exact province match
  if (candidateProv === campaignProv) {
    // Check district
    if (candidate.district && campaign.district) {
      const candidateDist = normalizeText(candidate.district);
      const campaignDist = normalizeText(campaign.district);
      if (candidateDist === campaignDist || campaignDist.includes(candidateDist)) {
        return { score: 25, matched: true, details: `Cùng khu vực: ${campaign.district}, ${campaign.province}` };
      }
    }
    return { score: 20, matched: true, details: `Cùng tỉnh/thành: ${campaign.province}` };
  }

  // Adjacent/Same region - simplified check
  const majorCities = ['hanoi', 'hochiminh', 'danang', 'haiphong', 'cantho'];
  if (majorCities.includes(candidateProv) && majorCities.includes(campaignProv)) {
    return { score: 5, matched: false, details: 'Khác thành phố lớn' };
  }

  return { score: 0, matched: false, details: `Khác khu vực` };
}

function calculateJobTypeScore(candidate, campaign) {
  if (!candidate.desired_job || !campaign.job_type) {
    return { score: 5, max: 20, matched: false, details: 'Chưa có thông tin công việc mong muốn' };
  }

  const desired = normalizeText(candidate.desired_job);
  const jobType = normalizeText(campaign.job_type);
  const title = normalizeText(campaign.title || '');

  // Direct match with job_type
  if (desired.includes(jobType) || jobType.includes(desired)) {
    return { score: 20, matched: true, details: `Phù hợp công việc: ${campaign.job_type}` };
  }

  // Match with title
  if (desired.includes(title) || title.includes(desired)) {
    return { score: 18, matched: true, details: `Phù hợp vị trí: ${campaign.title}` };
  }

  // Keyword matching
  const keywords = extractKeywords(desired);
  const jobKeywords = extractKeywords(jobType + ' ' + title);
  const matchingKeywords = keywords.filter(k => jobKeywords.includes(k));

  if (matchingKeywords.length > 0) {
    return { score: 12, matched: true, details: `Liên quan: ${matchingKeywords.join(', ')}` };
  }

  return { score: 0, matched: false, details: 'Khác ngành nghề' };
}

function calculateShiftScore(candidate, campaign) {
  if (!candidate.preferred_shift || !campaign.shift_text) {
    return { score: 5, max: 15, matched: false, details: 'Chưa có thông tin ca làm việc' };
  }

  const preferred = candidate.preferred_shift.toLowerCase();
  const shift = normalizeText(campaign.shift_text);

  // Direct match
  const shiftMap = {
    'morning': ['sang', 'morning', '6h', '7h', '8h', 'ca 1', 'ca mot'],
    'afternoon': ['chieu', 'afternoon', '14h', '13h', '12h', 'ca 2', 'ca hai'],
    'night': ['dem', 'night', 'toi', 'evening', '22h', 'ca 3', 'ca dem'],
    'full_day': ['full', 'nguyen ngay', 'ca ngay', '8 tieng', '10 tieng', '12 tieng'],
    'flexible': ['linh hoat', 'flexible', 'xoan ca', 'rotation', 'ca xoan']
  };

  const preferredKeywords = shiftMap[preferred] || [preferred];
  const hasMatch = preferredKeywords.some(kw => shift.includes(kw));

  if (hasMatch) {
    return { score: 15, matched: true, details: `Phù hợp ca: ${campaign.shift_text}` };
  }

  // Partial match - flexible can match any
  if (preferred === 'flexible') {
    return { score: 10, matched: true, details: 'Ca linh hoạt phù hợp mọi ca' };
  }

  return { score: 0, matched: false, details: `Khác ca làm việc` };
}

function calculateExperienceScore(candidate, campaign) {
  if (!candidate.experience_years && candidate.experience_years !== 0) {
    return { score: 5, max: 15, matched: false, details: 'Chưa có thông tin kinh nghiệm' };
  }

  const exp = candidate.experience_years;

  // Parse requirements from campaign
  let requiredExp = 0;
  let isRequired = false;

  if (campaign.requirements) {
    try {
      const reqs = JSON.parse(campaign.requirements);
      if (Array.isArray(reqs)) {
        const expReq = reqs.find(r => 
          r.toLowerCase().includes('kinh nghiệm') || 
          r.toLowerCase().includes('nam') ||
          r.toLowerCase().includes('tháng')
        );
        if (expReq) {
          isRequired = true;
          const match = expReq.match(/(\d+)/);
          if (match) requiredExp = parseInt(match[1]);
        }
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  // Check shift_text and description for experience requirements
  const expText = `${campaign.shift_text || ''} ${campaign.description || ''}`.toLowerCase();
  if (!isRequired && (expText.includes('có kinh nghiệm') || expText.includes('kinh nghiệm'))) {
    isRequired = true;
    requiredExp = 1; // Default to at least 1 year
  }

  if (!isRequired) {
    // No experience required, any experience is a bonus
    if (exp > 0) {
      return { score: 15, matched: true, details: `Có ${exp} năm kinh nghiệm (không yêu cầu)` };
    }
    return { score: 10, matched: false, details: 'Không yêu cầu kinh nghiệm' };
  }

  // Has requirement
  if (exp >= requiredExp) {
    return { score: 15, matched: true, details: `Đủ kinh nghiệm: ${exp}/${requiredExp} năm` };
  }

  if (exp >= requiredExp * 0.5) {
    return { score: 8, matched: false, details: `Gần đủ kinh nghiệm: ${exp}/${requiredExp} năm` };
  }

  return { score: 0, matched: false, details: `Thiếu kinh nghiệm: ${exp}/${requiredExp} năm` };
}

function calculateBonusScore(candidate, campaign) {
  let score = 0;
  let details = [];
  let matched = false;

  // Check if stay-in is mentioned in campaign
  const jobText = `${campaign.description || ''} ${campaign.shift_text || ''} ${campaign.requirements || ''}`.toLowerCase();
  const mentionsStayIn = jobText.includes('o lai') || jobText.includes('ở lại') || jobText.includes('stay') || jobText.includes('tro') || jobText.includes('trọ');
  const mentionsTransport = jobText.includes('xe') || jobText.includes('di lai') || jobText.includes('đi lại') || jobText.includes('transport') || jobText.includes(' commuting');

  // Stay-in bonus
  if (candidate.is_stay_in_possible && mentionsStayIn) {
    score += 8;
    details.push('Có thể ở lại');
    matched = true;
  }

  // Transport bonus
  if (candidate.has_transport && mentionsTransport) {
    score += 7;
    details.push('Có phương tiện');
    matched = true;
  }

  // General bonus for having both (shows flexibility)
  if (candidate.is_stay_in_possible && candidate.has_transport && score === 0) {
    score = 5;
    details.push('Linh hoạt về chỗ ở và đi lại');
  }

  return {
    score,
    matched,
    details: details.join(', ') || 'Không có thông tin đặc biệt'
  };
}

function calculateAvailabilityScore(candidate, campaign) {
  // Check if candidate has specified availability
  if (candidate.available_date) {
    const avail = candidate.available_date.toLowerCase();
    if (avail.includes('ngay') || avail.includes('immediately') || avail.includes('now')) {
      return { score: 10, matched: true, details: 'Có thể đi làm ngay' };
    }
    return { score: 5, matched: false, details: 'Đã có ngày bắt đầu' };
  }

  return { score: 5, matched: false, details: 'Chưa xác định ngày bắt đầu' };
}

// Utility functions
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove Vietnamese diacritics
    .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function extractKeywords(text) {
  const normalized = normalizeText(text);
  const commonWords = ['va', 'cua', 'cho', 'tai', 'theo', 'voi', 've', 'mot', 'cai', 'nay', 'la', 'co', 'duoc', 'de', 'nhu', 'hang', 'cong', 'ty', 'nhan', 'vien', 'viec', 'lam', 'tuyen', 'dung', 'kinh', 'nghiem', 'nam', 'thang', 'tuoi', 'tu', 'den', 'va', 'hoac'];
  return normalized.split(' ').filter(w => w.length > 1 && !commonWords.includes(w));
}

/**
 * Find matching jobs for a candidate
 * @param {string|Object} candidateIdOrData - Candidate ID or full candidate data
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Sorted array of matching jobs
 */
export async function findMatchingJobs(candidateIdOrData, options = {}) {
  const db = await openDb();

  try {
    // Get candidate data
    let candidate;
    if (typeof candidateIdOrData === 'string') {
      candidate = await db.get(`
        SELECT * FROM candidates WHERE id = ?
      `, candidateIdOrData);
    } else {
      candidate = candidateIdOrData;
    }

    if (!candidate) {
      throw new Error('Candidate not found');
    }

    // Build query for active campaigns
    let whereClause = "status = 'active' AND visibility IN ('public_candidate', 'ctv_private')";
    const params = [];

    // Optional filters
    if (options.province) {
      whereClause += " AND (province = ? OR province IS NULL)";
      params.push(options.province);
    }

    if (options.jobType) {
      whereClause += " AND (job_type LIKE ? OR title LIKE ?)";
      params.push(`%${options.jobType}%`, `%${options.jobType}%`);
    }

    // Get campaigns
    const campaigns = await db.all(`
      SELECT 
        c.*,
        co.name as company_name,
        co.company_code
      FROM campaigns c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE ${whereClause}
      AND (c.max_leads IS NULL OR c.current_leads < c.max_leads)
      AND (c.end_date IS NULL OR c.end_date >= date('now'))
      ORDER BY c.created_at DESC
      LIMIT 100
    `, params);

    // Calculate match scores
    const matches = campaigns.map(campaign => {
      const matchResult = calculateMatchScore(candidate, campaign);
      return {
        job: {
          id: campaign.id,
          campaign_code: campaign.campaign_code,
          title: campaign.title,
          job_type: campaign.job_type,
          description: campaign.description,
          location: campaign.location,
          province: campaign.province,
          district: campaign.district,
          salary_text: campaign.salary_text,
          shift_text: campaign.shift_text,
          requirements: campaign.requirements,
          company: {
            name: campaign.company_name,
            code: campaign.company_code
          }
        },
        match: matchResult
      };
    });

    // Sort by score (descending)
    matches.sort((a, b) => b.match.score - a.match.score);

    // Filter by minimum score if specified
    const minScore = options.minScore || 0;
    return matches.filter(m => m.match.score >= minScore);

  } finally {
    await db.close();
  }
}

/**
 * Quick match for chatbot - simplified interface
 * @param {Object} candidateData - Basic candidate info
 * @returns {Promise<Array>} Top 5 matching jobs
 */
export async function quickMatch(candidateData) {
  const matches = await findMatchingJobs(candidateData, { minScore: 20 });
  return matches.slice(0, 5);
}
