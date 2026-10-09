const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const rules = require('../rules.js');

const root = path.resolve(__dirname, '..');

test('Manifest V3 declares only the browser capabilities used by the extension', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, '102');
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(manifest.permissions.includes('tabs'));
  assert.ok(manifest.permissions.includes('alarms'));
  assert.ok(manifest.permissions.includes('idle'));
  const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
  assert.match(background, /setAccessLevel\(\{\s*accessLevel:\s*'TRUSTED_CONTEXTS'/);
  assert.match(background, /sender\.url !== chrome\.runtime\.getURL\('popup\.html'\)/);
  const popup = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
  assert.match(popup, /id="login-api-base"/);
  assert.match(popup, /id="login-dashboard-url"/);
  assert.ok(manifest.content_scripts[0].matches.includes('https://*/*'));
  assert.ok(fs.existsSync(path.join(root, manifest.action.default_popup)));
});

test('host rule matching respects enabled rules, app domains, custom domains, and subdomains', () => {
  const rulesToTest = [
    { id: 'disabled', activity: 'Instagram', enabled: false },
    { id: 'instagram', activity: 'Instagram', enabled: true },
    { id: 'x', activity: 'X', enabled: true },
    { id: 'custom', activity: 'Custom Website', target: 'example.com', enabled: true },
    { id: 'any', activity: 'Any Website', enabled: true },
  ];

  assert.equal(rules.selectRuleForHost(rulesToTest, 'www.instagram.com').id, 'instagram');
  assert.equal(rules.selectRuleForHost(rulesToTest, 'docs.example.com').id, 'custom');
  assert.equal(rules.selectRuleForHost(rulesToTest, 'notexample.com').id, 'any');
  assert.equal(rules.selectRuleForHost(rulesToTest.slice(0, 3), 'instagram.com').id, 'instagram');
  assert.equal(rules.selectRuleForHost([], 'instagram.com'), null);
  assert.equal(rules.selectRuleForHost(rulesToTest, 'x.com').id, 'x');
  assert.equal(rules.selectRuleForHost(rulesToTest, 'www.twitter.com').id, 'x');
});

test('extension content script never receives authentication token through its message contract', () => {
  const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
  const content = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(content, /RESTIFY_GET_INTERVENTION/);
  assert.match(content, /RESTIFY_SHOW_REST/);
  assert.doesNotMatch(content, /Authorization|Bearer|token/i);
  assert.doesNotMatch(background, /console\.(log|error)\(/);
  assert.match(background, /apiRequest\('\/auth\/logout', \{ method: 'POST' \}\)/);
});
