import repl from 'repl';

function evaluate(evalCmd, context, filename, callback) {
  const cmd = evalCmd.toLowerCase().trim();
  switch (cmd) {
    case 'quit':
    case 'exit': {
      console.log('Bye!');
      replServer.close();
      return;
    }
    default:
      callback(null, `Unrecognized command '${cmd}'.`);
  }
}

function modifyOutput(output: string) {
  return output.trim();
}

const replServer = repl.start({
  prompt: 'db.js >> ',
  eval: evaluate,
  writer: modifyOutput,
});
