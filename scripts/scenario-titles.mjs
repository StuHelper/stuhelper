import ts from 'typescript';

export function scenarioTitles(file, source) {
  const titles = new Set();
  if (file.endsWith('_test.go')) {
    // Go raw strings, interpreted literals and comments can contain entire fake declarations.
    const code = source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|`[^`]*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, token =>
      token.startsWith('/') ? ' ' : '""');
    for (const match of code.matchAll(/^\s*func\s+(Test[A-Za-z0-9_]+)\s*\(\s*\w+\s+\*testing\.T\s*\)\s*\{/gm)) titles.add(match[1]);
    return titles;
  }
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        ['test', 'it', 'memberTest'].includes(node.expression.text) && node.arguments.length >= 2) {
      const title = node.arguments[0];
      if (ts.isStringLiteralLike(title)) titles.add(title.text);
      if (ts.isTemplateExpression(title) && title.templateSpans.length === 1) {
        const [span] = title.templateSpans;
        if (title.head.text.endsWith(' (') && ts.isIdentifier(span.expression) &&
            span.expression.text === 'locale' && span.literal.text === ')') {
          titles.add(title.head.text.slice(0, -2));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return titles;
}
