import repl from 'repl';

enum PrepareStatementResult {
  Success,
  SyntaxError,
  Unrecognized,
}

enum StatementType {
  INSERT,
  SELECT,
}

interface Statement {
  type: StatementType;
  cmd: string;
}

// type Row = [number, string, string];

function prepareStatement(cmd: string): {
  stmt?: Statement;
  result: PrepareStatementResult;
} {
  const firstWord = cmd.split(' ')[0].toLowerCase();

  if (firstWord === 'insert') {
    if (!isLegalInsertStatement(cmd)) {
      return { result: PrepareStatementResult.SyntaxError };
    }
    return {
      stmt: { type: StatementType.INSERT, cmd },
      result: PrepareStatementResult.Success,
    };
  }

  if (cmd === 'select') {
    return {
      stmt: { type: StatementType.SELECT, cmd },
      result: PrepareStatementResult.Success,
    };
  }

  return { result: PrepareStatementResult.Unrecognized };
}

const InsertStatementRegex = /^insert\s+([1-9]\d*)\s+(\w+)\s+([a-z@.]+)$/i;

function executeStatement(stmt: Statement): string {
  switch (stmt.type) {
    case StatementType.INSERT:
      return 'This is where we would do an insert.\n';
    case StatementType.SELECT:
      return 'This is where we would do a select.\n';
  }
}

function isLegalInsertStatement(cmd: string) {
  return InsertStatementRegex.test(cmd);
}

repl.start({
  prompt: 'db.js >> ',
  eval: (evalCmd, context, filename, callback) => {
    const cmd = evalCmd.trim();
    const { stmt, result } = prepareStatement(cmd);

    if (result === PrepareStatementResult.Unrecognized) {
      callback(null, `Unrecognized keyword at start of '${cmd}'.\n`);
    } else if (result === PrepareStatementResult.SyntaxError) {
      callback(null, `Syntax error. Could not parse statement.\n`);
    } else {
      callback(null, executeStatement(stmt!));
    }
  },
  writer: output => output.trim(),
});
