/**
 * services/contexts.js —— 注入令牌集中定义
 * 令牌必须同一模块实例；散落定义会导致 consume 拿不到值。
 */
import { createContext } from '@lit/context';

export const authContext = createContext('hello.auth');
