import repl from 'repl';

enum PrepareStatementResult {
  Success,
  Unrecognized,
}

enum StatementType {
  INSERT,
  SELECT,
}

interface Statement {
  type: StatementType;
}

function prepareStatement(cmd: string): {
  stmt?: Statement;
  result: PrepareStatementResult;
} {
  const firstWord = cmd.split(' ')[0].toLowerCase();
  if (firstWord === 'select') {
    return {
      stmt: { type: StatementType.SELECT },
      result: PrepareStatementResult.Success,
    };
  }

  if (firstWord === 'insert') {
    return {
      stmt: { type: StatementType.INSERT },
      result: PrepareStatementResult.Success,
    };
  }

  return { result: PrepareStatementResult.Unrecognized };
}

function executeStatement(stmt: Statement): string {
  switch (stmt.type) {
    case StatementType.INSERT:
      return 'This is where we would do an insert.\n';
    case StatementType.SELECT:
      return 'This is where we would do a select.\n';
  }
}

repl.start({
  prompt: 'db.js >> ',
  eval: (evalCmd, _, __, callback) => {
    const cmd = evalCmd.trim();
    const { stmt, result } = prepareStatement(cmd);

    if (result === PrepareStatementResult.Unrecognized) {
      callback(null, `Unrecognized command '${cmd}'.`);
    } else {
      callback(null, executeStatement(stmt!));
    }
  },
  writer: output => output.trim(),
});
