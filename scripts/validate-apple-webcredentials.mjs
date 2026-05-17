import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.PROJECT_ROOT || fileURLToPath(new URL('..', import.meta.url));
const appConfigPath = join(root, 'mobile', 'app.json');
const associationPath = join(root, 'frontend', 'public', '.well-known', 'apple-app-site-association');
const testflightPath = join(root, 'mobile', 'TESTFLIGHT.md');

const appConfig = JSON.parse(readFileSync(appConfigPath, 'utf8'));
const association = JSON.parse(readFileSync(associationPath, 'utf8'));
const testflightGuide = readFileSync(testflightPath, 'utf8');

const bundleIdentifier = appConfig?.expo?.ios?.bundleIdentifier;
const associatedDomains = appConfig?.expo?.ios?.associatedDomains || [];
const webcredentialApps = association?.webcredentials?.apps || [];
const expectedDomain = 'webcredentials:carbonrackapp.com';
const expectedBundleIdentifier = 'CarbonRackOrg.CarbonRackApp';
const expectedTeamId = 'YT85VSXYAF';
const expectedAppleAppId = `${expectedTeamId}.${expectedBundleIdentifier}`;

if (bundleIdentifier !== expectedBundleIdentifier) {
  throw new Error(
    `mobile/app.json expo.ios.bundleIdentifier must be ${expectedBundleIdentifier}, got ${bundleIdentifier || '<missing>'}.`,
  );
}

if (!associatedDomains.includes(expectedDomain)) {
  throw new Error(`mobile/app.json must include ${expectedDomain} in expo.ios.associatedDomains.`);
}

if (!webcredentialApps.includes(expectedAppleAppId)) {
  throw new Error(`apple-app-site-association webcredentials.apps must include ${expectedAppleAppId}.`);
}

if (!testflightGuide.includes(`iOS bundle identifier: \`${bundleIdentifier}\``)) {
  throw new Error(`mobile/TESTFLIGHT.md must document iOS bundle identifier ${bundleIdentifier}.`);
}

if (!testflightGuide.includes(`Associated Domain: \`${expectedDomain}\``)) {
  throw new Error(`mobile/TESTFLIGHT.md must document Associated Domain ${expectedDomain}.`);
}

if (!testflightGuide.includes(`覆盖 \`${bundleIdentifier}\` 所属 Team ID`)) {
  throw new Error(`mobile/TESTFLIGHT.md must document the AASA coverage for ${bundleIdentifier}.`);
}
