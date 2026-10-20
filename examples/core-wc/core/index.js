/**
 * core/index.js —— 核心库唯一公共出口。
 * 只 export 纯逻辑；internal/ 下的实现不对外暴露。
 */
export { quote, round2, formatMoney } from './quote.js';
