<template>
  <div class="pdf-preview" :style="{ bottom: playerVisible ? '64px' : '0' }">
    <div class="pdf-head">
      <span class="pdf-name" :title="name">{{ name }}</span>
      <a class="pdf-btn" :href="url" download>下载</a>
      <a class="pdf-btn" :href="url" target="_blank" rel="noopener">新标签页打开</a>
      <button class="pdf-btn pdf-close" @click="$emit('close')" title="关闭预览">✕</button>
    </div>
    <iframe
      v-if="renderer === 'iframe'"
      class="pdf-frame"
      :src="url"
      :title="name"></iframe>
    <div v-else class="pdf-canvas-scroll" ref="scrollBox">
      <div v-if="status === 'loading'" class="pdf-canvas-state">{{ stateText }}</div>
      <div v-else-if="status === 'error'" class="pdf-canvas-state">
        加载失败，请用“新标签页打开”查看。
      </div>
      <div v-else ref="pagesBox" class="pdf-canvas-pages"></div>
    </div>
  </div>
</template>

<script>
// 站内 PDF 预览两种渲染：
// - iframe：浏览器自带查看器（桌面端，含选词/打印等完整能力）。
// - canvas：pdf.js 逐页渲染到画布（窄屏端）。手机浏览器内嵌查看器
//   在 iframe 里不保证贴合页宽（2026-11-04 案：站内打不开贴合、
//   新标签页却可以），而画布宽度由我们自己算（容器宽 / 页宽），
//   在任何手机浏览器上都一定贴合；代价是暂无框选复制文字。
// pdf.js 用自托管的 3.11.174 UMD 版（/assets/pdfjs/，与 worker 同源，
//   避免跨域 worker 被拦；cmaps 随包自带，中文 PDF 不缺字）。
let pdfjsLoadPromise = null;
function loadPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsLoadPromise) {
    pdfjsLoadPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/assets/pdfjs/pdf.js';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.js';
        resolve(window.pdfjsLib);
      };
      s.onerror = () => {
        pdfjsLoadPromise = null;
        reject(new Error('pdf.js load failed'));
      };
      document.head.appendChild(s);
    });
  }
  return pdfjsLoadPromise;
}

export default {
  props: {
    url: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: '',
    },
    renderer: {
      type: String,
      default: 'iframe',
    },
    // 播放条在时浮层底部留出 64px，PDF 末页不被播放条盖住；
    // 浮层本身不卸载播放器，音乐继续播。
    playerVisible: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['close'],

  data() {
    return {
      status: 'loading',
      stateText: '正在加载…',
      // 注意：pdf.js 文档对象绝不能放进 data——Vue 的响应式 Proxy
      // 会让 pdf.js 私有字段（#pagePromises 等）读取抛错；
      // 只挂在实例普通属性上（pdfDocInstance，不进响应式）。
      destroyed: false,
      resizeTimer: null,
    };
  },

  mounted() {
    if (this.renderer === 'canvas') {
      this.startCanvas();
      window.addEventListener('resize', this.onResize);
    }
  },

  beforeUnmount() {
    this.destroyed = true;
    window.removeEventListener('resize', this.onResize);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    if (this.pdfDocInstance) {
      const doc = this.pdfDocInstance;
      this.pdfDocInstance = null;
      doc.destroy().catch(() => {});
    }
  },

  methods: {
    // fetch 不发 fragment：取 url 去掉 # 后的部分，贴合页宽参数
    // 只给浏览器查看器用，画布模式不需要。
    canvasFetchUrl() {
      return this.url.split('#')[0];
    },

    async startCanvas() {
      try {
        const pdfjsLib = await loadPdfjs();
        if (this.destroyed) return;
        const res = await fetch(this.canvasFetchUrl());
        if (!res.ok) throw new Error('fetch failed: ' + res.status);
        const data = await res.arrayBuffer();
        if (this.destroyed) return;
        const loadingTask = pdfjsLib.getDocument({
          data,
          cMapUrl: '/assets/pdfjs/cmaps/',
          cMapPacked: true,
        });
        loadingTask.onProgress = (p) => {
          if (p.total > 0) {
            this.stateText =
              '正在加载… ' + Math.round((p.loaded / p.total) * 100) + '%';
          }
        };
        this.pdfDocInstance = await loadingTask.promise;
        if (this.destroyed) return;
        this.status = 'ready';
        await this.$nextTick();
        await this.renderAll();
      } catch (e) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('PdfPreview canvas failed:', e);
        }
        if (!this.destroyed) this.status = 'error';
      }
    },

    containerWidth() {
      // 可用宽度 = 画布页容器的内容宽（去掉 .pdf-canvas-pages 的
      // 左右 padding），否则画布会比内容区宽 16px、出现横向滚动条。
      const box = this.$refs.pagesBox;
      if (!box) return 0;
      const style = window.getComputedStyle(box);
      return (
        box.clientWidth -
        parseFloat(style.paddingLeft || '0') -
        parseFloat(style.paddingRight || '0')
      );
    },

    async renderAll() {
      const box = this.$refs.pagesBox;
      const width = this.containerWidth();
      if (!box || !this.pdfDocInstance || width <= 0) return;
      box.innerHTML = '';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (let i = 1; i <= this.pdfDocInstance.numPages; i++) {
        if (this.destroyed) return;
        this.stateText = '正在渲染第 ' + i + ' / ' + this.pdfDocInstance.numPages + ' 页…';
        const page = await this.pdfDocInstance.getPage(i);
        if (this.destroyed) return;
        const base = page.getViewport({ scale: 1 });
        const scale = (width / base.width) * dpr;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = width + 'px';
        canvas.style.height = Math.floor(viewport.height / dpr) + 'px';
        canvas.className = 'pdf-canvas-page';
        box.appendChild(canvas);
        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
        }).promise;
      }
      this.stateText = '';
    },

    onResize() {
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        if (!this.destroyed && this.status === 'ready') this.renderAll();
      }, 200);
    },
  },
};
</script>

<style>
.pdf-preview {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-family: '寒蝉半圆体', -apple-system, BlinkMacSystemFont, 'Segoe UI Adjusted',
    'Segoe UI', 'Liberation Sans', sans-serif;
}

.pdf-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(57, 144, 155, 0.3);
}

.pdf-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 15px;
}

.pdf-btn {
  flex: none;
  padding: 6px 14px;
  font-size: 14px;
  color: rgb(57, 144, 155);
  background: rgba(57, 144, 155, 0.12);
  border: none;
  border-radius: 50px;
  text-decoration: none;
  cursor: pointer;
}

.pdf-close {
  padding: 6px 12px;
}

.pdf-frame {
  flex: 1;
  width: 100%;
  border: none;
}

.pdf-canvas-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #f2f2f2;
}

.pdf-canvas-state {
  padding: 40px 20px;
  text-align: center;
  color: #666;
  font-size: 15px;
}

.pdf-canvas-pages {
  padding: 8px;
}

.pdf-canvas-page {
  display: block;
  margin: 0 auto 8px;
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
}

@media (max-width: 480px) {
  .pdf-head {
    padding: 8px;
    gap: 8px;
  }

  .pdf-btn {
    padding: 6px 10px;
    font-size: 14px;
  }
}
</style>
