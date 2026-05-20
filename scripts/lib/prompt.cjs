/**
 * Minimal interactive prompts (no extra dependencies).
 */
const readline = require('readline');

function createRl() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(question, defaultAnswer = '') {
  const hint = defaultAnswer ? ` [${defaultAnswer}]` : '';
  return new Promise((resolve) => {
    const rl = createRl();
    rl.question(`${question}${hint}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed === '' ? defaultAnswer : trimmed);
    });
  });
}

function askYesNo(question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  return ask(`${question} (${hint})`, defaultYes ? 'y' : 'n').then((a) => {
    const lower = a.toLowerCase();
    if (lower === '') return defaultYes;
    return lower === 'y' || lower === 'yes';
  });
}

/** Masked input for API tokens (not echoed). */
function askSecret(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(`${question} (入力は表示されません): `);

    if (!stdin.isTTY) {
      const rl = createRl();
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';

    const onData = (chunk) => {
      const char = chunk;

      if (char === '\u0003') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        reject(new Error('Cancelled'));
        return;
      }

      if (char === '\r' || char === '\n' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(value.trim());
        return;
      }

      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
        return;
      }

      value += char;
    };

    stdin.on('data', onData);
  });
}

module.exports = { ask, askYesNo, askSecret };
