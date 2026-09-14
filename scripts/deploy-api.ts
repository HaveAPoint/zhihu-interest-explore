import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const ENV_ID = process.env['CLOUDBASE_ENV_ID'] ?? 'hackerson-d0g0z55d2fc446485';

async function deployApi() {
  console.log(`🚀 Starting explore-api deployment to CloudBase env: ${ENV_ID}...`);

  // 1. Build server bundle
  console.log('1. Compiling server package...');
  execSync('npm run build -w server', { stdio: 'inherit', cwd: process.cwd() });

  // 2. Ensure bootstrap exists and is executable
  const bootstrapPath = path.resolve(process.cwd(), 'server/scf_bootstrap');
  if (!fs.existsSync(bootstrapPath)) {
    throw new Error(`scf_bootstrap not found at ${bootstrapPath}`);
  }
  fs.chmodSync(bootstrapPath, 0o755);

  // 3. Deploy via CloudBase CLI
  console.log('2. Deploying explore-api HTTP cloud function via CloudBase CLI...');
  try {
    execSync(`npx tcb fn deploy explore-api --httpFn -e ${ENV_ID}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('✅ explore-api cloud function deployed successfully!');
  } catch (err: any) {
    console.error('❌ Failed to deploy function to CloudBase:', err.message);
    console.error('💡 Note: Ensure you are logged into CloudBase with `npx tcb login`.');
    process.exit(1);
  }
}

deployApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
