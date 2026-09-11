const { execSync } = require('child_process');
const path = require('path');

const tests = [
  'test-ticket-01.js',
  'test-ticket-02.js',
  'test-ticket-03.js',
  'test-ticket-04.js'
];

console.log('====================================================');
console.log('Running Full Extension Regression Test Suite');
console.log('====================================================\n');

let passed = 0;
for (const test of tests) {
  const testPath = path.join(__dirname, test);
  try {
    const output = execSync(`node "${testPath}"`, { encoding: 'utf8' });
    console.log(output);
    passed++;
  } catch (err) {
    console.error(`FAILED: ${test}`);
    console.error(err.stdout || err.message);
    process.exit(1);
  }
}

console.log('====================================================');
console.log(`Summary: ${passed}/${tests.length} test suites PASSED (100%)`);
console.log('====================================================');
