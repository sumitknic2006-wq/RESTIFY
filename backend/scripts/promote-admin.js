const mongoose = require('mongoose');
const User = require('../src/models/User');
const { connectMongoDB } = require('../src/config/db');

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || process.argv.length !== 3) {
    const error = new Error('Usage: node scripts/promote-admin.js <existing-account-email>');
    error.safeToDisplay = true;
    throw error;
  }

  await connectMongoDB();
  const result = await User.updateOne({ email }, { $set: { role: 'admin' } });
  if (result.matchedCount !== 1) {
    const error = new Error('No existing account matched the supplied email.');
    error.safeToDisplay = true;
    throw error;
  }
  process.stdout.write('Administrator role assigned to the selected existing account.\n');
}

main()
  .catch((error) => {
    process.stderr.write(
      `${error.safeToDisplay ? error.message : 'Could not promote administrator. Check trusted deployment configuration and database connectivity.'}\n`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
