import type { RulesLogic, AdditionalOperation } from 'json-logic-js';

export type JsonLogic = RulesLogic<AdditionalOperation>;

export declare function transformJsToJsonLogic(code: string): JsonLogic;
