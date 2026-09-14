/**
 * Smoke test for CloudBase deployment (T32a acceptance criteria):
 * 1. Public web root returns 200
 * 2. API health returns 200
 * 3. Discipline skeleton returns 200
 * 4. Private /me without credentials returns 401 UNAUTHORIZED
 */

async function smokeTest() {
  const apiOrigin = process.env['API_ORIGIN'] || process.argv[2];
  const webOrigin = process.env['APP_ORIGIN'] || process.argv[3];

  console.log('🧪 Starting CloudBase Deployment Smoke Test (T32a)...');
  console.log(`- API Origin: ${apiOrigin || '(not specified, test against localhost if omitted)'}`);
  console.log(`- Web Origin: ${webOrigin || '(not specified, test against localhost if omitted)'}`);

  const targetApi = apiOrigin || 'http://localhost:9000';
  const targetWeb = webOrigin || 'http://localhost:5173';

  let hasError = false;

  // 1. Check API Health
  try {
    const res = await fetch(`${targetApi}/health`);
    if (res.status === 200) {
      const data = await res.json();
      console.log(`✅ [PASS] API /health returned 200:`, data);
    } else {
      console.error(`❌ [FAIL] API /health returned status ${res.status}`);
      hasError = true;
    }
  } catch (err: any) {
    console.error(`❌ [FAIL] API /health unreachable: ${err.message}`);
    hasError = true;
  }

  // 2. Check Skeleton Endpoint (agent-app-dev)
  try {
    const res = await fetch(`${targetApi}/disciplines/agent-app-dev`);
    if (res.status === 200) {
      const data = await res.json();
      console.log(`✅ [PASS] API /disciplines/agent-app-dev returned 200, nodes count: ${data.data?.nodes?.length ?? 0}`);
    } else {
      console.error(`❌ [FAIL] API /disciplines/agent-app-dev returned status ${res.status}`);
      hasError = true;
    }
  } catch (err: any) {
    console.error(`❌ [FAIL] API /disciplines/agent-app-dev unreachable: ${err.message}`);
    hasError = true;
  }

  // 3. Check Private /me (Must return 401 without auth)
  try {
    const res = await fetch(`${targetApi}/me`);
    if (res.status === 401) {
      const data = await res.json();
      console.log(`✅ [PASS] Private /me correctly rejected unauthenticated request with 401:`, data?.error?.code);
    } else {
      console.error(`❌ [FAIL] Private /me returned ${res.status}, expected 401 UNAUTHORIZED`);
      hasError = true;
    }
  } catch (err: any) {
    console.error(`❌ [FAIL] Private /me unreachable: ${err.message}`);
    hasError = true;
  }

  // 4. Check Web Origin (Static Hosting)
  try {
    const res = await fetch(targetWeb);
    if (res.status === 200) {
      const text = await res.text();
      const hasTitle = text.includes('知乎');
      console.log(`✅ [PASS] Web origin returned 200, contains app shell: ${hasTitle}`);
    } else {
      console.error(`❌ [FAIL] Web origin returned status ${res.status}`);
      hasError = true;
    }
  } catch (err: any) {
    console.error(`❌ [FAIL] Web origin unreachable: ${err.message}`);
    hasError = true;
  }

  if (hasError) {
    console.error('\n❌ Smoke tests encountered failures!');
    process.exit(1);
  } else {
    console.log('\n🎉 All smoke tests passed successfully! Cloud deployment verified.');
  }
}

smokeTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
