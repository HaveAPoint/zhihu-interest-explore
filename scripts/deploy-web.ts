import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const ENV_ID = process.env['CLOUDBASE_ENV_ID'] ?? 'hackerson-d0g0z55d2fc446485';

async function deployWeb() {
  console.log(`🌐 Starting web dashboard deployment to CloudBase hosting env: ${ENV_ID}...`);

  // 1. Build and package release bundles (ensuring plugin zip is embedded in web/public/downloads/)
  console.log('1. Packaging release assets and building web dist...');
  execSync('npm run package:release', { stdio: 'inherit', cwd: process.cwd() });
  execSync('npm run release:check', { stdio: 'inherit', cwd: process.cwd() });

  const webDist = path.resolve(process.cwd(), 'dist/web');
  if (!fs.existsSync(webDist)) {
    throw new Error(`Web dist directory not found at ${webDist}`);
  }

  // 2. Deploy static hosting
  console.log('2. Uploading static files to CloudBase Static Hosting...');
  try {
    execSync(`npx tcb hosting deploy dist/web -e ${ENV_ID}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('✅ Web static assets deployed successfully!');

    console.log('3. Querying hosting details...');
    execSync(`npx tcb hosting detail -e ${ENV_ID}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (err: any) {
    console.error('❌ Failed to deploy static hosting:', err.message);
    console.error('💡 Note: Ensure you are logged into CloudBase with `npx tcb login`.');
    process.exit(1);
  }
}

deployWeb().catch((err) => {
  console.error(err);
  process.exit(1);
});
