import { test, expect } from '@playwright/test';

// Environment variables - NO HARDCODED PASSWORDS
const BASE_URL = process.env.STAGING_URL || 'http://40.233.83.234';
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'staging';
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || '';

// Validate required env vars
test.beforeAll(() => {
  if (!BASIC_AUTH_PASS) {
    console.warn('Warning: BASIC_AUTH_PASS not set. Set via: $env:BASIC_AUTH_PASS="your_password"');
  }
});

test.describe('Phase 3D - Browser QA', () => {
  
  // ==================== GUEST ROLE ====================
  test.describe('Guest Role', () => {
    
    test('trang chủ load đúng', async ({ page }) => {
      // Set Basic Auth credentials
      if (BASIC_AUTH_PASS) {
        await page.setExtraHTTPHeaders({
          'Authorization': 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64')
        });
      }
      await page.goto(BASE_URL);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page).toHaveTitle(/Việc Làm Gần Nhà/);
    });

    test('/nha-tuyen-dung là landing public', async ({ page }) => {
      if (BASIC_AUTH_PASS) {
        await page.setExtraHTTPHeaders({
          'Authorization': 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64')
        });
      }
      await page.goto(`${BASE_URL}/nha-tuyen-dung`);
      await expect(page.locator('text=Dành cho công ty')).toBeVisible();
      // Không có dashboard data
      await expect(page.locator('text=Dashboard')).not.toBeVisible();
    });

    test('Guest không thấy dashboard/data', async ({ page }) => {
      if (BASIC_AUTH_PASS) {
        await page.setExtraHTTPHeaders({
          'Authorization': 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64')
        });
      }
      await page.goto(`${BASE_URL}/ctv/dashboard`);
      // Expect redirect hoặc access denied
      await expect(page.locator('body')).not.toContainText('Hoa hồng');
    });
  });

  // ==================== CTV ROLE ====================
  test.describe('CTV Role', () => {
    
    test.beforeEach(async ({ page }) => {
      if (BASIC_AUTH_PASS) {
        await page.setExtraHTTPHeaders({
          'Authorization': 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64')
        });
      }
      await page.goto(BASE_URL);
      // Set CTV role via dev switcher hoặc mock
      await page.evaluate(() => {
        localStorage.setItem('dev_role', 'ctv');
        localStorage.setItem('user_id', 'ctv-001');
      });
      await page.reload();
    });

    test('Dashboard CTV load từ API', async ({ page }) => {
      await page.goto(`${BASE_URL}/ctv/dashboard`);
      await expect(page.locator('text=CTV Dashboard')).toBeVisible();
      await expect(page.locator('text=Campaign Active')).toBeVisible();
    });

    test('Campaigns active hiển thị với hoa hồng 80%', async ({ page }) => {
      await page.goto(`${BASE_URL}/ctv/dashboard`);
      const commission = await page.locator('text=480,000').first();
      await expect(commission).toBeVisible();
    });

    test('Submit lead mới từ UI thành công', async ({ page }) => {
      await page.goto(`${BASE_URL}/ctv/dashboard`);
      await page.click('text=Gửi Lead Mới');
      await page.fill('[name="candidate_name"]', 'Test User');
      await page.fill('[name="candidate_phone"]', '0909123456');
      await page.selectOption('[name="campaign"]', { label: 'Tuyển bảo vệ ca đêm' });
      await page.click('text=Gửi Lead');
      await expect(page.locator('text=Đã gửi lead thành công')).toBeVisible();
    });

    test('Submit trùng số bị chặn không lộ data', async ({ page }) => {
      await page.goto(`${BASE_URL}/ctv/dashboard`);
      await page.click('text=Gửi Lead Mới');
      await page.fill('[name="candidate_name"]', 'Test Duplicate');
      await page.fill('[name="candidate_phone"]', '0901111111'); // Existing number
      await page.click('text=Gửi Lead');
      // Expect error without sensitive data
      await expect(page.locator('text=Số điện thoại đã tồn tại')).toBeVisible();
      await expect(page.locator('body')).not.toContainText('Nguyễn Văn An'); // No leak
    });
  });

  // ==================== COMPANY ROLE ====================
  test.describe('Company Role', () => {
    
    test.beforeEach(async ({ page }) => {
      if (BASIC_AUTH_PASS) {
        await page.setExtraHTTPHeaders({
          'Authorization': 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64')
        });
      }
      await page.goto(BASE_URL);
      await page.evaluate(() => {
        localStorage.setItem('dev_role', 'company');
        localStorage.setItem('company_id', 'comp-001');
      });
      await page.reload();
    });

    test('Lead chưa claim ẩn contact', async ({ page }) => {
      await page.goto(`${BASE_URL}/company/dashboard`);
      // Check for hidden/masked phone
      const phoneMask = await page.locator('text=***').first();
      await expect(phoneMask).toBeVisible();
    });

    test('Claim lead unlock contact', async ({ page }) => {
      await page.goto(`${BASE_URL}/company/dashboard`);
      await page.click('text=Nhận Lead').first();
      await expect(page.locator('text=090')).toBeVisible(); // Phone now visible
    });

    test('Không có export/download số điện thoại', async ({ page }) => {
      await page.goto(`${BASE_URL}/company/dashboard`);
      await expect(page.locator('text=Export')).not.toBeVisible();
      await expect(page.locator('text=Download')).not.toBeVisible();
    });
  });

  // ==================== ADMIN ROLE ====================
  test.describe('Admin Role', () => {
    
    test.beforeEach(async ({ page }) => {
      if (BASIC_AUTH_PASS) {
        await page.setExtraHTTPHeaders({
          'Authorization': 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64')
        });
      }
      await page.goto(BASE_URL);
      await page.evaluate(() => {
        localStorage.setItem('dev_role', 'admin');
      });
      await page.reload();
    });

    test('Tax report 20/80 đúng', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/console`);
      await expect(page.locator('text=120,000')).toBeVisible(); // 20%
      await expect(page.locator('text=480,000')).toBeVisible(); // 80%
      await expect(page.locator('text=Math check: OK')).toBeVisible();
    });

    test('Audit logs hiển thị', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/console`);
      await expect(page.locator('text=Audit Logs')).toBeVisible();
      const logs = await page.locator('table tr').count();
      expect(logs).toBeGreaterThan(0);
    });
  });

  // ==================== TECHNICAL ====================
  test.describe('Technical Checks', () => {
    
    test('Console không có lỗi đỏ', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      if (BASIC_AUTH_PASS) {
        await page.setExtraHTTPHeaders({
          'Authorization': 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64')
        });
      }
      await page.goto(BASE_URL);
      await page.waitForTimeout(3000);
      expect(errors.filter(e => !e.includes('401'))).toHaveLength(0);
    });

    test('Mobile responsive', async ({ page }) => {
      if (BASIC_AUTH_PASS) {
        await page.setExtraHTTPHeaders({
          'Authorization': 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64')
        });
      }
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(BASE_URL);
      await page.waitForTimeout(2000);
      const h1 = await page.locator('h1').boundingBox();
      expect(h1?.width).toBeLessThan(375);
    });
  });
});
