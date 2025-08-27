import { parse, parseExpression, type ParserOptions } from '@babel/parser';
import type * as t from '@babel/types';

type JsonLogic = any; // минимальная аннотация для совместимости текущих тестов

function processOp(operator: string): string {
  switch (operator) {
    case '||':
      return 'or';
    case '&&':
      return 'and';
    default:
      return operator;
  }
}

function replaceVariable(name: string) {
  const replace = (rule: JsonLogic): JsonLogic => {
    if (rule == null) return rule;
    if (Array.isArray(rule)) return rule.map(replace);
    if (typeof rule !== 'object') return rule;

    if (Object.prototype.hasOwnProperty.call(rule, 'var')) {
      const value = (rule as any).var;
      if (value === name) return { var: '' };
      return rule;
    }

    const result: Record<string, JsonLogic> = {};
    for (const [key, value] of Object.entries(rule)) {
      result[key] = replace(value);
    }
    return result;
  };

  return replace;
}

function processError(node: any, message: string): never {
  const error = new Error(message) as Error & { at?: any };
  const at = node?.at ?? node?.loc;
  if (at) {
    (error as any).at = at;
  }
  throw error;
}

function literalValue(node: t.Node): unknown {
  switch (node.type) {
    case 'NumericLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
      return node.type === 'NullLiteral' ? null : (node as any).value;
    case 'RegExpLiteral': {
      const n = node as t.RegExpLiteral;
      return [n.pattern, n.flags];
    }
    default:
      return null;
  }
}

function memberToPath(
  node: t.MemberExpression | (t.Node & { type: 'OptionalMemberExpression' }),
  valueOnly: boolean,
): JsonLogic {
  const objectNode = (node as t.MemberExpression).object as t.Node;
  const propertyNode = (node as t.MemberExpression).property as t.Node;
  const object = objectNode.type === 'Identifier' ? (objectNode as t.Identifier).name : processNode(objectNode, true);
  let property: any;
  if (propertyNode.type === 'Identifier') property = (propertyNode as t.Identifier).name;
  else if (propertyNode.type === 'StringLiteral' || propertyNode.type === 'NumericLiteral')
    property = (propertyNode as any).value;
  else property = processNode(propertyNode, true);
  const value = `${object}.${property}`;
  return valueOnly ? value : { var: value };
}

function processNode(node: t.Node | null | undefined, valueOnly = false): JsonLogic {
  if (!node) return null;

  switch (node.type) {
    case 'File': {
      return processNode((node as any).program);
    }
    case 'Program': {
      const n = node as t.Program;
      if (n.body.length === 0) {
        const directives = (n as any).directives || [];
        if (directives.length === 1) {
          return directives[0]?.value?.value ?? null;
        }
        if (directives.length > 1) return processError(node, 'Only one expression statement allowed.');
      }
      if (n.body.length > 1) return processError(node, 'Only one expression statement allowed.');
      return processNode(n.body[0] as any);
    }

    case 'TemplateLiteral': {
      const n = node as t.TemplateLiteral;
      const nodes: JsonLogic[] = [];
      const expressions = n.expressions;
      let index = 0;
      for (const elem of n.quasis) {
        if ((elem as any).value?.cooked) nodes.push((elem as any).value.cooked);
        if (index < expressions.length) {
          const expr = expressions[index++];
          nodes.push(processNode(expr as any));
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
      return processNode((node as any).argument);
    }

    case 'ChainExpression': {
      return processNode((node as any).expression, valueOnly);
    }

    case 'ArrayExpression': {
      const n = node as t.ArrayExpression;
      if (n.elements.some((el) => el && el.type === 'SpreadElement')) {
        return {
          merge: n.elements.map((el) => (el ? processNode(el as any) : null)),
        };
      }
      return n.elements.map((el) => (el ? processNode(el as any) : null));
    }

    case 'ObjectExpression': {
      const n = node as t.ObjectExpression;
      const result: Record<string, JsonLogic> = {};
      for (const prop of n.properties) {
        if (prop.type === 'SpreadElement') continue;
        const key = (prop as any).key as t.Node;
        const value = (prop as any).value as t.Node;
        result[processNode(key, true) as string] = processNode(value);
      }
      return result;
    }

    case 'Identifier': {
      const n = node as t.Identifier;
      if (n.name === 'undefined') return null;
      return valueOnly ? n.name : { var: n.name };
    }

    case 'ExpressionStatement': {
      return processNode((node as any).expression);
    }

    case 'BlockStatement': {
      const n = node as t.BlockStatement;
      if (n.body.length > 1)
        return processError(
          node,
          'Block statements can only have one expression statement.',
        );
      return processNode(n.body[0] as any);
    }

    case 'CallExpression': {
      const n = node as t.CallExpression;
      const key = n.callee.type !== 'Identifier' ? (processNode(n.callee as any, true) as string) : (n.callee as t.Identifier).name;
      return { [key]: n.arguments.map((arg) => processNode(arg as any)) } as Record<string, JsonLogic>;
    }

    case 'OptionalCallExpression': {
      const n = node as any;
      const key = n.callee.type !== 'Identifier' ? (processNode(n.callee, true) as string) : n.callee.name;
      return { [key]: n.arguments.map((arg: any) => processNode(arg)) } as Record<string, JsonLogic>;
    }

    case 'LogicalExpression':
    case 'BinaryExpression': {
      const n = node as any;
      return {
        [processOp(n.operator)]: [processNode(n.left), processNode(n.right)],
      } as Record<string, JsonLogic>;
    }

    case 'CoalesceExpression': {
      const n = node as any;
      return { '??': [processNode(n.left), processNode(n.right)] };
    }

    case 'UnaryExpression': {
      const n = node as any;
      if (n.operator === '!' && n.argument.type === 'UnaryExpression' && n.argument.operator === '!') {
        return { '!!': [processNode(n.argument.argument)] };
      }
      if (n.operator === '-' && n.argument.type === 'NumericLiteral') {
        return (n.argument.value as number) * -1;
      }
      return { [n.operator]: [processNode(n.argument)] } as Record<string, JsonLogic>;
    }

    case 'ConditionalExpression': {
      const n = node as any;
      return { if: [processNode(n.test), processNode(n.consequent), processNode(n.alternate)] } as Record<string, JsonLogic>;
    }

    case 'MemberExpression': {
      return memberToPath(node as t.MemberExpression, valueOnly);
    }
    case 'OptionalMemberExpression': {
      return memberToPath(node as any, valueOnly);
    }

    case 'IfStatement': {
      const n = node as any;
      const parts = [processNode(n.test), processNode(n.consequent)];
      if (n.alternate) parts.push(processNode(n.alternate));
      return { if: parts } as Record<string, JsonLogic>;
    }

    case 'ArrowFunctionExpression': {
      const n = node as any;
      if (n.body.type === 'BlockStatement' && n.body.body.length > 1) {
        return processError(n, 'Only one-line arrow functions with implicit return are supported.');
      }
      const params = n.params.map((p: any) => processNode(p));
      const body = processNode(n.body);
      if (!params.length || params.length > 1) return body;
      const paramObj = params[0];
      const paramName = paramObj && typeof paramObj === 'object' ? (paramObj as any).var : undefined;
      if (!paramName) return body;
      return replaceVariable(paramName)(body);
    }

    case 'ReturnStatement': {
      return processNode((node as any).argument);
    }

    case 'UpdateExpression': {
      return processError(node, 'Update expressions (x++, ++x, x--, --x, etc.) are not supported.');
    }
    case 'TaggedTemplateExpression': {
      return processError(node, 'Tagged template expressions are not supported.');
    }
    case 'NewExpression': {
      return processError(node, 'Expressions that use the `new` keyword are not supported.');
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
      return processError(node, 'Variable (var, let, const) declarations are not supported.');
    }
    case 'AssignmentExpression': {
      return processError(node, 'Assignments not supported.');
    }
    case 'PrivateName': {
      return processError(node, "Private names are not supported. Unexpected character '#'");
    }

    default: {
      return processError(node, `Invalid node '${(node as any).type}'. Not supported.`);
    }
  }
}

export function transformJsToJsonLogic(code: string): JsonLogic {
  try {
    const commonOptions: ParserOptions = {
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      plugins: [
        'bigInt' as any,
        'optionalChaining',
        'nullishCoalescingOperator',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'numericSeparator',
        'logicalAssignment',
        'importMeta',
      ] as any,
      errorRecovery: false,
    } as ParserOptions;

    try {
      const ast = parse(code, commonOptions);
      return processNode(ast as any);
    } catch (errParse) {
      const expr = parseExpression(code, commonOptions);
      return processNode(expr as any);
    }
  } catch (e: any) {
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


