const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function generatePasswordHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`pbkdf2:${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

async function main() {
  const password = await new Promise(resolve => {
    rl.question('Enter admin password: ', resolve);
  });

  rl.close();

  if (!password) {
    console.log('Password cannot be empty.');
    process.exit(1);
  }

  const salt = crypto.randomBytes(16);
  const hashedPassword = await generatePasswordHash(password, salt);

  console.log(`
ADMIN_PASSWORD_HASH="${hashedPassword}"
ADMIN_LOGIN_EMAIL="your_admin_email@example.com" # Update this in your .env
ADMIN_SESSION_SECRET="${crypto.randomBytes(32).toString('hex')}" # Update this in your .env
`);
  console.log('Copy the above lines into your .env file and update the email.');
}

main();