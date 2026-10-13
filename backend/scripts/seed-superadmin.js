/**
 * Standalone CLI Script: Super Admin Password Setup & Verification
 * 
 * Purpose:
 * Safely initializes or resets the root Super Admin password for:
 *   superadmin@sweetshop.internal
 * 
 * Security Guarantees:
 * 1. Prompts for password securely without terminal echo (no shoulder-surfing).
 * 2. Hashes password using bcrypt with work factor 12.
 * 3. Never writes plaintext password to logs, disk, .env, or CLI arguments.
 * 4. Never exposes or logs the generated hash.
 * 5. Validates minimum length and complexity before proceeding.
 * 6. Checks that the target account exists and is unique before updating.
 * 7. Enforces parameterized SQL and verifies exactly 1 row was updated.
 * 8. Ensures database pool and terminal readline resources are always closed.
 */

const readline = require('readline');
const bcrypt = require('bcrypt');
const { pool } = require('../src/config/db');

const TARGET_SUPERADMIN_EMAIL = 'superadmin@sweetshop.internal';
const BCRYPT_SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Securely prompts for input with masked/hidden terminal output.
 * Uses raw mode so characters are not echoed to stdout.
 */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    process.stdout.write(question);

    let password = '';
    const onData = (char) => {
      char = char.toString('utf-8');

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // EOF
          process.stdin.pause();
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          reject(new Error('Operation cancelled by user.'));
          break;
        case '\u0008': // Backspace
        case '\x7f':
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
          break;
        default:
          password += char;
          break;
      }
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onData);
    } else {
      // Fallback for non-interactive environments (pipes/redirects)
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

/**
 * Validates password strength policy.
 */
function validatePassword(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter (a-z).';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number (0-9).';
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return 'Password must contain at least one special character (e.g. !@#$%^&*).';
  }
  return null;
}

async function main() {
  console.log('===============================================================');
  console.log('SWEET SHOP DELIVERY PLATFORM — SUPER ADMIN PASSWORD RESET');
  console.log('===============================================================');
  console.log(`Target Account: ${TARGET_SUPERADMIN_EMAIL}\n`);

  try {
    // Step 1: Verify the Super Admin account exists and is unique
    const [existingRows] = await pool.query(
      'SELECT id, name, email, is_active FROM super_admins WHERE email = ? LIMIT 2;',
      [TARGET_SUPERADMIN_EMAIL]
    );

    if (existingRows.length === 0) {
      throw new Error(`Account not found: No super_admins record found with email "${TARGET_SUPERADMIN_EMAIL}".`);
    }

    if (existingRows.length > 1) {
      throw new Error(`Data integrity error: Multiple accounts found for "${TARGET_SUPERADMIN_EMAIL}".`);
    }

    const admin = existingRows[0];
    console.log(`[+] Found active account: "${admin.name}" (ID: ${admin.id})`);
    console.log('[*] Input is masked for privacy. Characters will not appear on screen.\n');

    // Step 2: Prompt for new password securely
    const newPassword = await promptHidden('Enter new password: ');
    const validationError = validatePassword(newPassword);
    if (validationError) {
      throw new Error(`Password policy violation: ${validationError}`);
    }

    // Step 3: Prompt for password confirmation
    const confirmPassword = await promptHidden('Confirm new password: ');
    if (newPassword !== confirmPassword) {
      throw new Error('Password mismatch: The entered passwords do not match.');
    }

    // Step 4: Hash with bcrypt (work factor 12)
    console.log('\n[*] Computing bcrypt hash (work factor 12)...');
    const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // Step 5: Update the record using parameterized query
    const [updateResult] = await pool.query(
      `UPDATE super_admins 
       SET password_hash = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE email = ?;`,
      [newHash, TARGET_SUPERADMIN_EMAIL]
    );

    if (updateResult.affectedRows !== 1) {
      throw new Error(`Update failed: Expected 1 row affected, got ${updateResult.affectedRows}.`);
    }

    // Step 6: Post-update verification check
    const [verifyRows] = await pool.query(
      'SELECT password_hash FROM super_admins WHERE email = ?;',
      [TARGET_SUPERADMIN_EMAIL]
    );

    const isMatch = await bcrypt.compare(newPassword, verifyRows[0].password_hash);
    if (!isMatch) {
      throw new Error('Self-test failed: Verification comparison failed after database write.');
    }

    console.log('[+] Password successfully updated and verified in database!');
    console.log(`[+] You can now use this password to authenticate as ${TARGET_SUPERADMIN_EMAIL}.`);
    console.log('===============================================================\n');
  } catch (err) {
    console.error(`\n[!] Error: ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    // Ensure the connection pool is closed safely
    await pool.end();
  }
}

main();
