import { parse, parseExpression } from '@babel/parser';

function processOp(operator) {
  switch (operator) {
    case '||':
      return 'or';
    case '&&':
      return 'and';
    default:
      return operator;
  }
}

function replaceVariable(name) {
  const replace = (rule) => {
    if (rule == null) return rule;
    if (Array.isArray(rule)) return rule.map(replace);
    if (typeof rule !== 'object') return rule;

    // If this is a JSON-Logic var reference
    if (Object.prototype.hasOwnProperty.call(rule, 'var')) {
      const value = rule.var;
      if (value === name) return { var: '' };
      return rule;
    }

    const result = {};
    for (const [key, value] of Object.entries(rule)) {
      result[key] = replace(value);
    }
    return result;
  };

  return replace;
}

function processError(node, message) {
  const error = new Error(message);
  const at = node?.at ?? node?.loc;
  if (at) {
    error.at = at;
  }
  throw error;
}

function literalValue(node) {
  switch (node.type) {
    case 'NumericLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
      return node.type === 'NullLiteral' ? null : node.value;
    case 'RegExpLiteral':
      return [node.pattern, node.flags];
    default:
      return null;
  }
}

// (removed unused helper)

function memberToPath(node, valueOnly) {
  const objectNode = node.object;
  const propertyNode = node.property;
  const object =
    objectNode.type === 'Identifier'
      ? objectNode.name
      : processNode(objectNode, true);
  let property;
  if (propertyNode.type === 'Identifier') property = propertyNode.name;
  else if (
    propertyNode.type === 'StringLiteral' ||
    propertyNode.type === 'NumericLiteral'
  )
    property = propertyNode.value;
  else property = processNode(propertyNode, true);
  const value = `${object}.${property}`;
  return valueOnly ? value : { var: value };
}

function processNode(node, valueOnly = false) {
  if (!node) return null;

  switch (node.type) {
    case 'File': {
      return processNode(node.program);
    }
    case 'Program': {
      if (node.body.length === 0) {
        const directives = node.directives || [];
        if (directives.length === 1) {
          // Single directive like "a" treated as literal string
          return directives[0]?.value?.value ?? null;
        }
        if (directives.length > 1)
          return processError(node, 'Only one expression statement allowed.');
      }
      if (node.body.length > 1)
        return processError(node, 'Only one expression statement allowed.');
      return processNode(node.body[0]);
    }

    case 'TemplateLiteral': {
      const nodes = [];
      const expressions = node.expressions;
      let index = 0;
      for (const elem of node.quasis) {
        if (elem.value?.cooked) nodes.push(elem.value.cooked);
        if (index < expressions.length) {
          const expr = expressions[index++];
          nodes.push(processNode(expr));
        }
      }
      if (nodes.length === 1) return nodes[0];
      return { cat: nodes };
    }

    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'RegExpLiteral': {
      return literalValue(node);
    }

    case 'SpreadElement': {
      return processNode(node.argument);
    }

    case 'ChainExpression': {
      // Unwrap optional chaining container
      return processNode(node.expression, valueOnly);
    }

    case 'ArrayExpression': {
      if (node.elements.some((el) => el && el.type === 'SpreadElement')) {
        return {
          merge: node.elements.map((el) => (el ? processNode(el) : null)),
        };
      }
      return node.elements.map((el) => (el ? processNode(el) : null));
    }

    case 'ObjectExpression': {
      const result = {};
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') continue;
        // ObjectProperty or ObjectMethod (methods not supported but treat value)
        const key = prop.key;
        const value = prop.value;
        result[processNode(key, true)] = processNode(value);
      }
      return result;
    }

    case 'Identifier': {
      if (node.name === 'undefined') return null;
      return valueOnly ? node.name : { var: node.name };
    }

    case 'ExpressionStatement': {
      return processNode(node.expression);
    }

    case 'BlockStatement': {
      if (node.body.length > 1)
        return processError(
          node,
          'Block statements can only have one expression statement.',
        );
      return processNode(node.body[0]);
    }

    case 'CallExpression': {
      const key =
        node.callee.type !== 'Identifier'
          ? processNode(node.callee, true)
          : node.callee.name;
      return { [key]: node.arguments.map((arg) => processNode(arg)) };
    }

    // Optional call behaves same as normal call in conversion output
    case 'OptionalCallExpression': {
      const key =
        node.callee.type !== 'Identifier'
          ? processNode(node.callee, true)
          : node.callee.name;
      return { [key]: node.arguments.map((arg) => processNode(arg)) };
    }

    case 'LogicalExpression':
    case 'BinaryExpression': {
      return {
        [processOp(node.operator)]: [
          processNode(node.left),
          processNode(node.right),
        ],
      };
    }

    // Some Babel versions may expose nullish coalescing as a distinct node type
    case 'CoalesceExpression': {
      return { '??': [processNode(node.left), processNode(node.right)] };
    }

    case 'UnaryExpression': {
      if (
        node.operator === '!' &&
        node.argument.type === 'UnaryExpression' &&
        node.argument.operator === '!'
      ) {
        return { '!!': [processNode(node.argument.argument)] };
      }
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') {
        return node.argument.value * -1;
      }
      return { [node.operator]: [processNode(node.argument)] };
    }

    case 'ConditionalExpression': {
      return {
        if: [
          processNode(node.test),
          processNode(node.consequent),
          processNode(node.alternate),
        ],
      };
    }

    case 'MemberExpression': {
      return memberToPath(node, valueOnly);
    }

    // Optional member access maps to same var path
    case 'OptionalMemberExpression': {
      return memberToPath(node, valueOnly);
    }

    case 'IfStatement': {
      const parts = [processNode(node.test), processNode(node.consequent)];
      if (node.alternate) parts.push(processNode(node.alternate));
      return { if: parts };
    }

    case 'ArrowFunctionExpression': {
      if (node.body.type === 'BlockStatement' && node.body.body.length > 1) {
        return processError(
          node,
          'Only one-line arrow functions with implicit return are supported.',
        );
      }
      const params = node.params.map((p) => processNode(p));
      const body = processNode(node.body);
      if (!params.length || params.length > 1) return body;
      const paramObj = params[0];
      const paramName =
        paramObj && typeof paramObj === 'object' ? paramObj.var : undefined;
      if (!paramName) return body;
      return replaceVariable(paramName)(body);
    }

    case 'ReturnStatement': {
      return processNode(node.argument);
    }

    // Unsupported features
    case 'UpdateExpression': {
      return processError(
        node,
        'Update expressions (x++, ++x, x--, --x, etc.) are not supported.',
      );
    }
    case 'TaggedTemplateExpression': {
      return processError(
        node,
        'Tagged template expressions are not supported.',
      );
    }
    case 'NewExpression': {
      return processError(
        node,
        'Expressions that use the `new` keyword are not supported.',
      );
    }
    case 'ClassDeclaration': {
      return processError(node, 'Classes are not supported.');
    }
    case 'FunctionDeclaration': {
      return processError(node, 'Function declarations are not supported.');
    }
    case 'WhileStatement': {
      return processError(node, 'While-loops are not supported.');
    }
    case 'ForStatement': {
      return processError(node, 'For-loops are not supported.');
    }
    case 'SwitchStatement': {
      return processError(node, 'Switch statements are not supported.');
    }
    case 'VariableDeclaration': {
      return processError(
        node,
        'Variable (var, let, const) declarations are not supported.',
      );
    }
    case 'AssignmentExpression': {
      return processError(node, 'Assignments not supported.');
    }
    case 'PrivateName': {
      return processError(
        node,
        "Private names are not supported. Unexpected character '#'",
      );
    }

    default: {
      return processError(node, `Invalid node '${node.type}'. Not supported.`);
    }
  }
}

export function transformJsToJsonLogic(code) {
  try {
    const commonOptions = {
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      plugins: [
        'bigInt',
        'optionalChaining',
        'nullishCoalescingOperator',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'numericSeparator',
        'logicalAssignment',
        'importMeta',
      ],
      errorRecovery: false,
    };

    try {
      const ast = parse(code, commonOptions);
      return processNode(ast);
    } catch (errParse) {
      // Fallback for top-level object literals and other pure expressions
      const expr = parseExpression(code, commonOptions);
      return processNode(expr);
    }
  } catch (e) {
    const at = e?.loc
      ? {
          start: { line: e.loc.line, column: e.loc.column },
          end: { line: e.loc.line, column: e.loc.column },
        }
      : e?.at;
    return processError({ at }, `Could not parse code. ${e.message}`);
  }
}

export default transformJsToJsonLogic;
