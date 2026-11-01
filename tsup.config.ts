import { defineConfig } from 'tsup';
// node:sqlite 只能通过 node: 前缀加载，保留所有内置模块的原生标识。
export default defineConfig({ removeNodeProtocol: false });
