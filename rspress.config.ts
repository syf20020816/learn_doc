import * as path from 'node:path';
import { defineConfig } from '@rspress/core';
import pluginMermaid from 'rspress-plugin-mermaid';
import { pluginPlayground } from '@rspress/plugin-playground';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  lang: 'zh',
  title: 'RTC × 现代前端 学习之路',
  icon: '/rspress-icon.png',
  logo: {
    light: '/rspress-light-logo.png',
    dark: '/rspress-dark-logo.png',
  },
  plugins: [
    pluginMermaid(),
    // 只有显式标注 ```jsx playground 的代码块才会渲染成可编辑预览
    pluginPlayground({ defaultRenderMode: 'pure' }),
  ],
});
